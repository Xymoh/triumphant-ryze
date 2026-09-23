const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  compareStandings,
  findQueueEntry,
  formatRank,
  formatTier,
  rankScore,
  winRate,
} = require('../utils/ranks.js');

const entry = (tier, rank, leaguePoints, wins = 10, losses = 10, extra = {}) => ({
  queueType: 'RANKED_SOLO_5x5',
  tier,
  rank,
  leaguePoints,
  wins,
  losses,
  ...extra,
});

test('rankScore orders every tier, including Emerald and apex tiers', () => {
  const ladder = [
    entry('IRON', 'IV', 0),
    entry('IRON', 'I', 99),
    entry('BRONZE', 'IV', 0),
    entry('SILVER', 'II', 50),
    entry('GOLD', 'I', 75),
    entry('PLATINUM', 'IV', 0),
    entry('EMERALD', 'IV', 0),
    entry('EMERALD', 'I', 99),
    entry('DIAMOND', 'IV', 0),
    entry('DIAMOND', 'I', 100),
    entry('MASTER', 'I', 0),
    entry('MASTER', 'I', 1400), // apex LP can go far past 100
    entry('GRANDMASTER', 'I', 500),
    entry('CHALLENGER', 'I', 1200),
  ];
  const scores = ladder.map(rankScore);
  for (let i = 1; i < scores.length; i += 1) {
    assert.ok(scores[i] > scores[i - 1], `${JSON.stringify(ladder[i])} should beat the previous`);
  }
  assert.equal(rankScore(null), -1);
});

test('divisions compare numerically, not alphabetically', () => {
  assert.ok(rankScore(entry('GOLD', 'I', 0)) > rankScore(entry('GOLD', 'IV', 99)));
  assert.ok(rankScore(entry('GOLD', 'II', 0)) > rankScore(entry('GOLD', 'III', 99)));
});

test('compareStandings: rank first, then win rate, games and name; unranked last', () => {
  const rows = [
    { player: { gameName: 'Unranked' }, entry: null },
    { player: { gameName: 'Zed' }, entry: entry('GOLD', 'II', 40, 10, 10) },
    { player: { gameName: 'Ahri' }, entry: entry('GOLD', 'II', 40, 10, 10) },
    { player: { gameName: 'BetterWr' }, entry: entry('GOLD', 'II', 40, 15, 5) },
    { player: { gameName: 'Emerald' }, entry: entry('EMERALD', 'IV', 0) },
  ];
  const order = rows.sort(compareStandings).map((row) => row.player.gameName);
  assert.deepEqual(order, ['Emerald', 'BetterWr', 'Ahri', 'Zed', 'Unranked']);
});

test('formatting', () => {
  assert.equal(formatTier(entry('EMERALD', 'II', 45)), 'Emerald II');
  assert.equal(formatTier(entry('GRANDMASTER', 'I', 300)), 'Grandmaster');
  assert.equal(formatTier(null), 'Unranked');
  assert.match(formatRank(entry('DIAMOND', 'III', 12)), /\*\*Diamond III\*\* · 12 LP$/);
  assert.equal(winRate(entry('GOLD', 'I', 0, 2, 1)), 67);
  assert.equal(winRate(null), 0);
});

test('findQueueEntry picks the right queue', () => {
  const entries = [
    { queueType: 'RANKED_FLEX_SR', tier: 'SILVER' },
    { queueType: 'RANKED_SOLO_5x5', tier: 'GOLD' },
  ];
  assert.equal(findQueueEntry(entries, 'solo').tier, 'GOLD');
  assert.equal(findQueueEntry(entries, 'flex').tier, 'SILVER');
  assert.equal(findQueueEntry([], 'solo'), null);
  assert.equal(findQueueEntry(undefined, 'solo'), null);
});
