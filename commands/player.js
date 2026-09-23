const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  escapeMarkdown,
} = require('discord.js');

const config = require('../config.js');
const riot = require('../utils/riot.js');
const {
  addPlayer,
  clearPlayers,
  countPlayers,
  findPlayerByPuuid,
  listPlayers,
} = require('../utils/db.js');
const { COLORS, successEmbed, warningEmbed } = require('../utils/embeds.js');
const { UserError } = require('../utils/errors.js');
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
  tierColor,
} = require('../utils/ranks.js');
const { getPlatform, regionChoices } = require('../utils/regions.js');
const { formatRiotId, parseRiotId } = require('../utils/riotId.js');

const canManageServer = (interaction) =>
  interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;

/** Saves the player and returns the confirmation embed. Shared by /player add and /profile's button. */
const trackPlayer = async (interaction, { account, platform, summoner, discordUserId }) => {
  const { guildId } = interaction;
  const name = escapeMarkdown(formatRiotId(account.gameName, account.tagLine));

  if (await findPlayerByPuuid(guildId, account.puuid)) {
    throw new UserError(`**${name}** is already on this server's leaderboard.`);
  }
  if ((await countPlayers(guildId)) >= config.maxPlayersPerGuild) {
    throw new UserError(
      `This server already tracks the maximum of **${config.maxPlayersPerGuild}** players. Remove someone with \`/player remove\` first.`
    );
  }

  const entries = await riot.getLeagueEntries(platform, account.puuid);
  try {
    await addPlayer({
      guildId,
      puuid: account.puuid,
      platform,
      gameName: account.gameName,
      tagLine: account.tagLine,
      discordUserId,
      addedBy: interaction.user.id,
      riotIdCheckedAt: new Date(),
    });
  } catch (error) {
    // Two people added the same player at the same moment.
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new UserError(`**${name}** is already on this server's leaderboard.`);
    }
    throw error;
  }

  const solo = findQueueEntry(entries, 'solo');
  const embed = new EmbedBuilder()
    .setColor(tierColor(solo))
    .setAuthor({
      name: `${formatRiotId(account.gameName, account.tagLine)} joined the leaderboard`,
      iconURL: summoner ? await riot.profileIconUrl(summoner.profileIconId) : undefined,
    })
    .addFields(
      Object.entries(QUEUES).map(([key, queue]) => {
        const entry = findQueueEntry(entries, key);
        return {
          name: queue.short,
          value: `${formatRank(entry)}\n${formatRecord(entry)}`,
          inline: true,
        };
      })
    )
    .setFooter({ text: `${getPlatform(platform).name} · added by ${interaction.user.username}` });

  if (discordUserId) embed.setDescription(`Linked to <@${discordUserId}>`);
  return embed;
};

const add = async (interaction) => {
  const riotId = parseRiotId(interaction.options.getString('riot-id'));
  const requested = interaction.options.getString('region');
  const member = interaction.options.getUser('member');
  if (member?.bot) throw new UserError("Bots don't play ranked (yet). Pick a real member to link.");

  await interaction.deferReply();
  const settings = await settingsFor(interaction);
  const player = await lookupPlayer(riotId, { requested, fallback: settings.region });
  const embed = await trackPlayer(interaction, { ...player, discordUserId: member?.id });
  await interaction.editReply({ embeds: [embed] });
};

const remove = async (interaction) => {
  const input = interaction.options.getString('player');
  const player = await findTrackedPlayer(interaction.guildId, input);
  if (!player) {
    throw new UserError(
      `**${escapeMarkdown(input)}** isn't on this server's leaderboard. See \`/player list\`.`
    );
  }

  await player.destroy();
  const name = escapeMarkdown(formatRiotId(player.gameName, player.tagLine));
  await interaction.reply({ embeds: [successEmbed(`Removed **${name}** from the leaderboard.`)] });
};

const list = async (interaction) => {
  const [players, settings] = await Promise.all([
    listPlayers(interaction.guildId),
    settingsFor(interaction),
  ]);

  const lines = players
    .map((player) => {
      const name = escapeMarkdown(formatRiotId(player.gameName, player.tagLine));
      const region = getPlatform(player.platform)?.label ?? player.platform;
      const member = player.discordUserId ? ` · <@${player.discordUserId}>` : '';
      return `**${name}** · \`${region}\`${member}`;
    })
    .sort((a, b) => a.localeCompare(b));

  let description = lines.join('\n');
  if (description.length > 4000) {
    const shown = description.slice(0, 3900).split('\n').slice(0, -1);
    description = `${shown.join('\n')}\n…and ${lines.length - shown.length} more`;
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.brand)
    .setTitle(`📋 Tracked players (${players.length}/${config.maxPlayersPerGuild})`)
    .setDescription(description || 'Nobody yet. Add someone with `/player add Name#TAG`.')
    .setFooter({ text: `Default region: ${getPlatform(settings.region).name}` });

  await interaction.reply({ embeds: [embed] });
};

const clear = async (interaction) => {
  if (!canManageServer(interaction)) {
    throw new UserError('You need the **Manage Server** permission to clear the leaderboard.');
  }
  const count = await countPlayers(interaction.guildId);
  if (count === 0) throw new UserError('There is nobody on the leaderboard to remove.');

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('player:clear-confirm')
      .setLabel(`Remove all ${count} players`)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('player:clear-cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({
    embeds: [warningEmbed(`This removes **all ${count} players** from this server's leaderboard.`)],
    components: [buttons],
    flags: MessageFlags.Ephemeral,
  });
};

/** "Add to leaderboard" button on /profile: player:track:<platform>:<puuid> */
const trackFromButton = async (interaction, platform, puuid) => {
  if (!getPlatform(platform) || !/^[\w-]{1,100}$/.test(puuid ?? '')) {
    throw new UserError('This button is no longer valid. Run `/profile` again.');
  }
  await interaction.deferReply();
  const [account, summoner] = await Promise.all([
    riot.getAccountByPuuid(puuid, getPlatform(platform).accountRegion),
    riot.getSummoner(platform, puuid),
  ]);
  const embed = await trackPlayer(interaction, { account, platform, summoner });
  await interaction.editReply({ embeds: [embed] });
};

const subcommands = { add, remove, list, clear };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('player')
    .setDescription('Manage who is on the leaderboard.')
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Add a player to the leaderboard.')
        .addStringOption((option) =>
          option
            .setName('riot-id')
            .setDescription('Riot ID, e.g. Faker#KR1')
            .setRequired(true)
            .setMaxLength(30)
        )
        .addStringOption((option) =>
          option
            .setName('region')
            .setDescription('Server they play on (detected automatically if left empty)')
            .addChoices(...regionChoices())
        )
        .addUserOption((option) =>
          option.setName('member').setDescription('Link this player to a Discord member')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove a player from the leaderboard.')
        .addStringOption((option) =>
          option
            .setName('player')
            .setDescription('Player to remove')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('List everyone on the leaderboard.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('clear')
        .setDescription('Remove every player from the leaderboard (Manage Server only).')
    ),

  async execute(interaction) {
    await subcommands[interaction.options.getSubcommand()](interaction);
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    await interaction.respond(await trackedPlayerChoices(interaction.guildId, focused));
  },

  async handleComponent(interaction, [action, ...args]) {
    if (action === 'track') {
      await trackFromButton(interaction, ...args);
      return;
    }

    if (action === 'clear-cancel') {
      await interaction.update({
        embeds: [successEmbed('Cancelled, nobody was removed.')],
        components: [],
      });
      return;
    }

    if (action === 'clear-confirm') {
      if (!canManageServer(interaction)) {
        throw new UserError('You need the **Manage Server** permission to clear the leaderboard.');
      }
      const removed = await clearPlayers(interaction.guildId);
      await interaction.update({
        embeds: [successEmbed(`Removed **${removed}** players from the leaderboard.`)],
        components: [],
      });
    }
  },
};
