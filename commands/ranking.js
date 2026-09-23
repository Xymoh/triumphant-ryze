const { EmbedBuilder, InteractionContextType, SlashCommandBuilder } = require('discord.js');

const riot = require('../utils/riot.js');
const { listPlayers } = require('../utils/db.js');
const { COLORS } = require('../utils/embeds.js');
const { UserError } = require('../utils/errors.js');
const { loadStandings, renderLeaderboard } = require('../utils/leaderboard.js');
const { refreshRiotIds } = require('../utils/players.js');
const { QUEUES } = require('../utils/ranks.js');

const EMPTY = {
  embeds: [
    new EmbedBuilder()
      .setColor(COLORS.brand)
      .setTitle('🏆 Leaderboard')
      .setDescription(
        'Nobody is on the leaderboard yet.\nAdd your friends with `/player add Name#TAG`, then run `/ranking` again.'
      ),
  ],
  components: [],
};

// Servers that installed only the slash commands (no bot user) have no cached guild object.
const guildOf = (interaction) =>
  interaction.guild ?? { id: interaction.guildId, name: 'This server', iconURL: () => null };

// The Refresh button skips the rank cache, but at most once per 30 seconds per server.
const REFRESH_COOLDOWN_MS = 30 * 1000;
const lastRefresh = new Map();

const forgetCachedRanks = (guildId, players) => {
  const now = Date.now();
  if (now - (lastRefresh.get(guildId) ?? 0) < REFRESH_COOLDOWN_MS) return;
  lastRefresh.set(guildId, now);
  for (const player of players) riot.forgetLeagueEntries(player.platform, player.puuid);
};

const buildMessage = async (guild, queue, page, { refresh = false } = {}) => {
  const players = await listPlayers(guild.id);
  if (players.length === 0) return EMPTY;
  if (refresh) forgetCachedRanks(guild.id, players);

  const rows = await loadStandings(players, queue);
  // Keep stored Riot IDs fresh for next time without making anyone wait for it.
  refreshRiotIds(players).catch((error) =>
    console.warn('[ranking] Riot ID refresh failed:', error)
  );

  return renderLeaderboard({ guild, queue, rows, page, skipped: players.length - rows.length });
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ranking')
    .setDescription("Show the server's ranked leaderboard.")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('queue')
        .setDescription('Ranked queue to compare (default: Solo/Duo)')
        .addChoices(
          ...Object.entries(QUEUES).map(([value, queue]) => ({ name: queue.short, value }))
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const queue = interaction.options.getString('queue') ?? 'solo';
    await interaction.editReply(await buildMessage(guildOf(interaction), queue, 0));
  },

  // Buttons: queue tabs, page arrows and refresh (see utils/leaderboard.js).
  async handleComponent(interaction, [queue, page, purpose]) {
    if (!QUEUES[queue]) throw new UserError('This leaderboard is outdated. Run `/ranking` again.');
    await interaction.deferUpdate();
    const message = await buildMessage(guildOf(interaction), queue, Number(page), {
      refresh: purpose === 'refresh',
    });
    await interaction.editReply(message);
  },
};
