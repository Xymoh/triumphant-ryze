const assert = require('node:assert/strict');
const { test } = require('node:test');

const { TtlCache } = require('../utils/cache.js');
const { mapWithConcurrency } = require('../utils/concurrency.js');
const { UserError } = require('../utils/errors.js');
const { RateLimiter, parseLimits } = require('../utils/rateLimiter.js');
const { parseRiotId, sameRiotId } = require('../utils/riotId.js');

test('parseRiotId accepts names with spaces and unicode, splits on the last #', () => {
  assert.deepEqual(parseRiotId('Faker#KR1'), { gameName: 'Faker', tagLine: 'KR1' });
  assert.deepEqual(parseRiotId('  Hide on bush # KR1 '), {
    gameName: 'Hide on bush',
    tagLine: 'KR1',
  });
  assert.deepEqual(parseRiotId('Zażółć#PL1'), { gameName: 'Zażółć', tagLine: 'PL1' });
  assert.deepEqual(parseRiotId('we#ird#EUW'), { gameName: 'we#ird', tagLine: 'EUW' });
});

test('parseRiotId rejects bad input with a friendly UserError', () => {
  assert.throws(() => parseRiotId('Faker'), UserError);
  assert.throws(() => parseRiotId('#EUW'), UserError);
  assert.throws(() => parseRiotId('Faker#'), UserError);
  assert.throws(() => parseRiotId('Faker#TOOLONG'), UserError);
  assert.throws(() => parseRiotId('ThisNameIsWayTooLong#EUW'), UserError);
});

test('sameRiotId is case-insensitive', () => {
  assert.ok(
    sameRiotId({ gameName: 'Faker', tagLine: 'KR1' }, { gameName: 'FAKER', tagLine: 'kr1' })
  );
  assert.ok(
    !sameRiotId({ gameName: 'Faker', tagLine: 'KR1' }, { gameName: 'Faker', tagLine: 'KR2' })
  );
});

test('TtlCache.wrap de-duplicates concurrent loads and does not cache failures', async () => {
  const cache = new TtlCache();
  let calls = 0;
  const loader = async () => {
    calls += 1;
    return 'value';
  };
  const results = await Promise.all([1, 2, 3].map(() => cache.wrap('key', 1000, loader)));
  assert.deepEqual(results, ['value', 'value', 'value']);
  assert.equal(calls, 1);

  let failures = 0;
  const failing = async () => {
    failures += 1;
    throw new Error('boom');
  };
  await assert.rejects(cache.wrap('bad', 1000, failing));
  await assert.rejects(cache.wrap('bad', 1000, failing));
  assert.equal(failures, 2);
});

test('TtlCache expires entries and stays under maxEntries', async () => {
  const cache = new TtlCache({ maxEntries: 3 });
  cache.set('short', 1, 1);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(cache.get('short'), undefined);

  for (const key of ['a', 'b', 'c', 'd']) cache.set(key, key, 10_000);
  assert.equal(cache.entries.size, 3);
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.get('d'), 'd');
});

test('parseLimits understands the X-App-Rate-Limit header format', () => {
  assert.deepEqual(parseLimits('20:1,100:120'), [
    { count: 20, windowMs: 1000 },
    { count: 100, windowMs: 120_000 },
  ]);
  assert.deepEqual(parseLimits('garbage'), []);
});

test('RateLimiter never exceeds the configured window', async () => {
  const limiter = new RateLimiter('3:1');
  const start = Date.now();
  const times = [];
  await Promise.all(
    Array.from({ length: 5 }, () => limiter.acquire().then(() => times.push(Date.now() - start)))
  );
  times.sort((a, b) => a - b);
  // The first three go immediately, the 4th and 5th have to wait for the 1 second window.
  assert.ok(times[2] < 200, `first three should be immediate, got ${times}`);
  assert.ok(times[3] >= 1000, `4th request must wait for the window, got ${times}`);
});

test('RateLimiter updates its limits from Riot headers and honours pauses', async () => {
  const limiter = new RateLimiter('1:1');
  limiter.setLimits('500:10,30000:600');
  assert.equal(limiter.limits.length, 2);
  limiter.pause(150);
  const start = Date.now();
  await limiter.acquire();
  assert.ok(Date.now() - start >= 140);
});

test('mapWithConcurrency keeps order and respects the limit', async () => {
  let active = 0;
  let peak = 0;
  const result = await mapWithConcurrency([5, 1, 3, 2, 4], 2, async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, value * 3));
    active -= 1;
    return value * 10;
  });
  assert.deepEqual(result, [50, 10, 30, 20, 40]);
  assert.equal(peak, 2);
});
