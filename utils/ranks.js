const { tierEmoji, tierImageUrl } = require('./emojis.js');

const TIERS = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
];
const APEX_TIERS = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER']);
const DIVISIONS = { IV: 0, III: 1, II: 2, I: 3 };

const QUEUES = {
  solo: { type: 'RANKED_SOLO_5x5', name: 'Ranked Solo/Duo', short: 'Solo/Duo' },
  flex: { type: 'RANKED_FLEX_SR', name: 'Ranked Flex', short: 'Flex' },
};

const TIER_COLORS = {
  IRON: 0x6b6461,
  BRONZE: 0x8c5a3c,
  SILVER: 0x8a9ba3,
  GOLD: 0xd4a53b,
  PLATINUM: 0x4fa7a3,
  EMERALD: 0x1e9e5a,
  DIAMOND: 0x5a7fe0,
  MASTER: 0x9d4dd8,
  GRANDMASTER: 0xd64545,
  CHALLENGER: 0xf0c75e,
  UNRANKED: 0x99aab5,
};

const titleCase = (value) => value.charAt(0) + value.slice(1).toLowerCase();

const findQueueEntry = (entries, queue) =>
  entries?.find((entry) => entry.queueType === QUEUES[queue].type) ?? null;

const gamesPlayed = (entry) => (entry ? entry.wins + entry.losses : 0);

const winRate = (entry) => {
  const games = gamesPlayed(entry);
  return games === 0 ? 0 : Math.round((entry.wins / games) * 100);
};

/**
 * A single number that orders ranks correctly, higher is better, unranked is -1. Tiers are spaced
 * far apart because apex tiers (Master+) have no divisions and LP there can go well past 1000.
 */
const rankScore = (entry) => {
  if (!entry) return -1;
  const tier = TIERS.indexOf(entry.tier);
  if (tier === -1) return -1;
  const division = APEX_TIERS.has(entry.tier) ? 0 : (DIVISIONS[entry.rank] ?? 0);
  return tier * 100_000 + division * 10_000 + (entry.leaguePoints ?? 0);
};

/** Sort comparator for { player, entry } rows: best rank first, then win rate, then games. */
const compareStandings = (a, b) =>
  rankScore(b.entry) - rankScore(a.entry) ||
  winRate(b.entry) - winRate(a.entry) ||
  gamesPlayed(b.entry) - gamesPlayed(a.entry) ||
  String(a.player.gameName).localeCompare(String(b.player.gameName));

/** "Emerald II" / "Master" / "Unranked" */
const formatTier = (entry) => {
  if (!entry) return 'Unranked';
  const tier = titleCase(entry.tier);
  return APEX_TIERS.has(entry.tier) ? tier : `${tier} ${entry.rank}`;
};

/** "🟢 **Emerald II** · 45 LP" */
const formatRank = (entry) => {
  if (!entry) return `${tierEmoji('UNRANKED')} **Unranked**`;
  return `${tierEmoji(entry.tier)} **${formatTier(entry)}** · ${entry.leaguePoints} LP`;
};

/** "128W 110L · 54% WR 🔥" */
const formatRecord = (entry) => {
  if (!entry) return 'No ranked games this split';
  const streak = entry.hotStreak ? ' 🔥' : '';
  return `${entry.wins}W ${entry.losses}L · ${winRate(entry)}% WR${streak}`;
};

const tierColor = (entry) => TIER_COLORS[entry?.tier] ?? TIER_COLORS.UNRANKED;

module.exports = {
  TIERS,
  QUEUES,
  findQueueEntry,
  gamesPlayed,
  winRate,
  rankScore,
  compareStandings,
  formatTier,
  formatRank,
  formatRecord,
  tierColor,
  tierEmblemUrl: tierImageUrl,
};
