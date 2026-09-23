const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  escapeMarkdown,
} = require('discord.js');

const riot = require('./riot.js');
const { mapWithConcurrency } = require('./concurrency.js');
const {
  QUEUES,
  compareStandings,
  findQueueEntry,
  formatRank,
  formatRecord,
  gamesPlayed,
  tierColor,
  tierEmblemUrl,
  winRate,
} = require('./ranks.js');
const { getPlatform, profileUrl } = require('./regions.js');
const { formatRiotId } = require('./riotId.js');

const PAGE_SIZE = 10;
const MEDALS = ['🥇', '🥈', '🥉'];
const MIN_GAMES_FOR_WIN_RATE = 10;

/**
 * Fetches every player's ranked entry for the queue (from cache when fresh) and sorts them.
 * A player that fails to load is shown with a warning instead of breaking the whole board; only
 * when *every* lookup fails (e.g. an expired API key) is the error thrown.
 */
const loadStandings = async (players, queue) => {
  const rows = await mapWithConcurrency(
    players.filter((player) => player.puuid),
    5,
    async (player) => {
      try {
        const entries = await riot.getLeagueEntries(player.platform, player.puuid);
        return { player, entry: findQueueEntry(entries, queue), failed: false };
      } catch (error) {
        return { player, entry: null, failed: true, error };
      }
    }
  );

  if (rows.length > 0 && rows.every((row) => row.failed)) throw rows[0].error;
  return rows.sort(compareStandings);
};

const pageCount = (rows) => Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

const clampPage = (page, rows) => Math.min(Math.max(0, page || 0), pageCount(rows) - 1);

const playerName = (player) => escapeMarkdown(formatRiotId(player.gameName, player.tagLine));

const standingLine = (row, position, showRegion) => {
  const { player, entry } = row;
  const place = MEDALS[position] ?? `\`#${position + 1}\``;
  const url = profileUrl(player.platform, player.gameName, player.tagLine);
  const name = url ? `[${playerName(player)}](${url})` : playerName(player);
  const member = player.discordUserId ? ` · <@${player.discordUserId}>` : '';
  const region = showRegion
    ? ` · \`${getPlatform(player.platform)?.label ?? player.platform}\``
    : '';
  const details = row.failed
    ? '⚠️ Could not load this rank right now'
    : `${formatRank(entry)} · ${formatRecord(entry)}`;
  return `${place} **${name}**${member}${region}\n${details}`;
};

/** Fun group stats shown on the first page. */
const highlightFields = (rows) => {
  const ranked = rows.filter((row) => row.entry);
  if (ranked.length < 2) return [];

  const fields = [];
  const eligible = ranked.filter((row) => gamesPlayed(row.entry) >= MIN_GAMES_FOR_WIN_RATE);
  if (eligible.length > 0) {
    const best = eligible.reduce((a, b) => (winRate(b.entry) > winRate(a.entry) ? b : a));
    fields.push({
      name: '🎯 Best win rate',
      value: `${playerName(best.player)}\n${winRate(best.entry)}% in ${gamesPlayed(best.entry)} games`,
      inline: true,
    });
  }

  const grinder = ranked.reduce((a, b) => (gamesPlayed(b.entry) > gamesPlayed(a.entry) ? b : a));
  fields.push({
    name: '🎮 Most games',
    value: `${playerName(grinder.player)}\n${gamesPlayed(grinder.entry)} games`,
    inline: true,
  });

  const onFire = ranked.filter((row) => row.entry.hotStreak);
  if (onFire.length > 0) {
    const names = onFire.slice(0, 3).map((row) => playerName(row.player));
    if (onFire.length > 3) names.push(`+${onFire.length - 3} more`);
    fields.push({ name: '🔥 On a win streak', value: names.join('\n'), inline: true });
  }

  return fields;
};

/** customId layout: ranking:<queue>:<page>:<purpose>. The purpose keeps IDs unique per message. */
const button = (queue, page, purpose) =>
  new ButtonBuilder().setCustomId(`ranking:${queue}:${page}:${purpose}`);

const buildComponents = (queue, page, pages) => {
  const row = new ActionRowBuilder();
  for (const [key, { short }] of Object.entries(QUEUES)) {
    row.addComponents(
      button(key, 0, 'tab')
        .setLabel(short)
        .setStyle(key === queue ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(key === queue)
    );
  }
  if (pages > 1) {
    row.addComponents(
      button(queue, page - 1, 'prev')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      button(queue, page + 1, 'next')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= pages - 1)
    );
  }
  row.addComponents(button(queue, page, 'refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary));
  return [row];
};

/** Builds the leaderboard message (embed + buttons) for one page. */
const renderLeaderboard = ({ guild, queue, rows, page = 0, skipped = 0 }) => {
  const pages = pageCount(rows);
  const current = clampPage(page, rows);
  const start = current * PAGE_SIZE;
  const showRegion = new Set(rows.map((row) => row.player.platform)).size > 1;
  const leader = rows[0];

  const lines = rows
    .slice(start, start + PAGE_SIZE)
    .map((row, index) => standingLine(row, start + index, showRegion));

  const rankedCount = rows.filter((row) => row.entry).length;
  const footer = [`${rows.length} players`, `${rankedCount} ranked`];
  if (pages > 1) footer.unshift(`Page ${current + 1}/${pages}`);
  if (skipped > 0) footer.push(`${skipped} need re-adding`);

  const embed = new EmbedBuilder()
    .setColor(tierColor(leader?.entry))
    .setAuthor({
      name: `${guild.name} · ${QUEUES[queue].name}`,
      iconURL: guild.iconURL() ?? undefined,
    })
    .setTitle('🏆 Leaderboard')
    .setDescription(lines.join('\n\n') || 'Nobody to show yet.')
    .setFooter({ text: footer.join(' · ') })
    .setTimestamp();

  if (leader?.entry) embed.setThumbnail(tierEmblemUrl(leader.entry.tier));
  if (current === 0) embed.addFields(highlightFields(rows));

  return { embeds: [embed], components: buildComponents(queue, current, pages) };
};

module.exports = { PAGE_SIZE, loadStandings, renderLeaderboard, clampPage };
