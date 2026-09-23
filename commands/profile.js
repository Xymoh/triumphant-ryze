const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionContextType,
  SlashCommandBuilder,
} = require('discord.js');

const riot = require('../utils/riot.js');
const {
  findTrackedPlayer,
  lookupPlayer,
  settingsFor,
  trackedPlayerChoices,
} = require('../utils/players.js');
const {
  QUEUES,
  findQueueEntry,
  formatRank,
  formatRecord,
  rankScore,
  tierColor,
  tierEmblemUrl,
} = require('../utils/ranks.js');
const { getPlatform, profileLinks, regionChoices } = require('../utils/regions.js');
const { formatRiotId, parseRiotId } = require('../utils/riotId.js');

const compactNumber = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Works out whose profile to show: a tracked player, or any Riot ID typed in. */
const resolveTarget = async (interaction) => {
  const input = interaction.options.getString('player');
  const requested = interaction.options.getString('region');
  const tracked = await findTrackedPlayer(interaction.guildId, input);

  if (tracked?.puuid && (!requested || requested === tracked.platform)) {
    const summoner = await riot.getSummoner(tracked.platform, tracked.puuid);
    return {
      puuid: tracked.puuid,
      platform: tracked.platform,
      gameName: tracked.gameName,
      tagLine: tracked.tagLine,
      discordUserId: tracked.discordUserId,
      tracked: true,
      summoner,
    };
  }

  const settings = await settingsFor(interaction);
  const riotId = tracked ?? parseRiotId(input);
  const { account, platform, summoner } = await lookupPlayer(riotId, {
    requested,
    fallback: settings.region,
  });
  return {
    puuid: account.puuid,
    platform,
    gameName: account.gameName,
    tagLine: account.tagLine,
    discordUserId: tracked?.discordUserId,
    tracked: false,
    summoner,
  };
};

const masteryLines = (masteries, championNames) =>
  masteries.map((mastery, index) => {
    const name = championNames?.get(mastery.championId) ?? `Champion ${mastery.championId}`;
    const points = compactNumber.format(mastery.championPoints);
    return `\`${index + 1}.\` **${name}** · Mastery ${mastery.championLevel} · ${points} pts`;
  });

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription("Show a player's ranks and top champions.")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('player')
        .setDescription('A tracked player, or any Riot ID like Faker#KR1')
        .setRequired(true)
        .setMaxLength(30)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName('region')
        .setDescription('Server they play on (detected automatically if left empty)')
        .addChoices(...regionChoices())
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const target = await resolveTarget(interaction);
    const platform = getPlatform(target.platform);

    const [entries, masteries, championNames, iconUrl] = await Promise.all([
      riot.getLeagueEntries(target.platform, target.puuid),
      riot.getTopMasteries(target.platform, target.puuid, 3).catch(() => []),
      riot.getChampionNames().catch(() => null),
      riot.profileIconUrl(target.summoner.profileIconId),
    ]);

    const ranked = Object.keys(QUEUES).map((queue) => findQueueEntry(entries, queue));
    const best = ranked.filter(Boolean).sort((a, b) => rankScore(b) - rankScore(a))[0] ?? null;
    const links = profileLinks(target.platform, target.gameName, target.tagLine);

    const details = [`Level **${target.summoner.summonerLevel}** · ${platform.name}`];
    if (target.tracked) details.push("📌 On this server's leaderboard");
    if (target.discordUserId) details.push(`🔗 <@${target.discordUserId}>`);

    const embed = new EmbedBuilder()
      .setColor(tierColor(best))
      .setAuthor({
        name: formatRiotId(target.gameName, target.tagLine),
        iconURL: iconUrl,
        url: links[0]?.url,
      })
      .setThumbnail((best && tierEmblemUrl(best.tier)) ?? iconUrl ?? null)
      .setDescription(details.join('\n'))
      .addFields(
        Object.values(QUEUES).map((queue, index) => ({
          name: queue.name,
          value: `${formatRank(ranked[index])}\n${formatRecord(ranked[index])}`,
          inline: true,
        }))
      );

    if (masteries.length > 0) {
      embed.addFields({
        name: '⭐ Top champions',
        value: masteryLines(masteries, championNames).join('\n'),
      });
    }

    const buttons = new ActionRowBuilder().addComponents(
      links.map(({ label, url }) =>
        new ButtonBuilder().setLabel(label).setURL(url).setStyle(ButtonStyle.Link)
      )
    );
    if (!target.tracked) {
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId(`player:track:${target.platform}:${target.puuid}`)
          .setLabel('Add to leaderboard')
          .setEmoji('➕')
          .setStyle(ButtonStyle.Success)
      );
    }

    await interaction.editReply({ embeds: [embed], components: [buttons] });
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    await interaction.respond(await trackedPlayerChoices(interaction.guildId, focused));
  },
};
