const { setTimeout: sleep } = require('node:timers/promises');

const config = require('../config.js');
const { TtlCache } = require('./cache.js');
const { RiotApiError } = require('./errors.js');
const { RateLimiter } = require('./rateLimiter.js');
const { getPlatform } = require('./regions.js');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 10 * 1000;

const cache = new TtlCache();
const limiters = new Map();

// Riot rate limits apply per routing value (euw1, europe, ...), so each host gets its own limiter.
const limiterFor = (host) => {
  if (!limiters.has(host)) limiters.set(host, new RateLimiter());
  return limiters.get(host);
};

/**
 * GET a Riot API path on the given routing host (e.g. "euw1" or "europe"). Waits for the rate
 * limiter, retries on 429 / 5xx / network errors, and throws RiotApiError otherwise.
 */
const request = async (host, path, { maxAttempts = MAX_ATTEMPTS } = {}) => {
  const limiter = limiterFor(host);

  for (let attempt = 1; ; attempt += 1) {
    await limiter.acquire();

    let response;
    try {
      response = await fetch(`https://${host}.api.riotgames.com${path}`, {
        headers: { 'X-Riot-Token': config.riotApiKey ?? '' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (attempt < maxAttempts) {
        await sleep(500 * attempt);
        continue;
      }
      throw new RiotApiError(0, path, undefined, { cause: error });
    }

    limiter.setLimits(response.headers.get('x-app-rate-limit'));
    if (response.ok) return response.json();

    const retryAfterMs = Number(response.headers.get('retry-after')) * 1000 || 1000 * attempt;
    if (response.status === 429) {
      // Only an application-wide limit should pause everyone; method limits just retry.
      if (response.headers.get('x-rate-limit-type') === 'application') limiter.pause(retryAfterMs);
      if (attempt < maxAttempts && retryAfterMs <= 10_000) {
        await sleep(retryAfterMs);
        continue;
      }
    } else if (response.status >= 500 && attempt < maxAttempts) {
      await sleep(500 * attempt);
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      console.error(
        '[riot] The Riot API key was rejected. Development keys expire every 24 hours; see README.'
      );
    }
    throw new RiotApiError(response.status, path, retryAfterMs);
  }
};

const cached = (key, ttlMs, loader) => cache.wrap(key, ttlMs, loader);

const platformHost = (platform) => {
  const info = getPlatform(platform);
  if (!info) throw new Error(`Unknown platform: ${platform}`);
  return info.id.toLowerCase();
};

// ---- Riot Account API (regional: americas / asia / europe) -----------------------------------

const getAccountByRiotId = (gameName, tagLine, accountRegion = 'europe') =>
  cached(`account:${gameName.toLowerCase()}#${tagLine.toLowerCase()}`, 10 * MINUTE, () =>
    request(
      accountRegion,
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    )
  );

const getAccountByPuuid = (puuid, accountRegion = 'europe') =>
  cached(`account:${puuid}`, 10 * MINUTE, () =>
    request(accountRegion, `/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`)
  );

/**
 * The League server a player is currently active on, or null if Riot can't tell us. Some accounts
 * always get a 500 here (open Riot bug), so don't retry: the caller falls back to a default region.
 */
const getActivePlatform = async (puuid, accountRegion = 'europe') => {
  try {
    const result = await cached(`active-region:${puuid}`, HOUR, () =>
      request(
        accountRegion,
        `/riot/account/v1/region/by-game/lol/by-puuid/${encodeURIComponent(puuid)}`,
        {
          maxAttempts: 1,
        }
      )
    );
    return getPlatform(result?.region)?.id ?? null;
  } catch (error) {
    if (error instanceof RiotApiError && error.status !== 401 && error.status !== 403) return null;
    throw error;
  }
};

// ---- League of Legends APIs (platform: euw1, na1, ...) ---------------------------------------

const getSummoner = (platform, puuid) =>
  cached(`summoner:${platform}:${puuid}`, 30 * MINUTE, () =>
    request(
      platformHost(platform),
      `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`
    )
  );

const getLeagueEntries = (platform, puuid) =>
  cached(`league:${platform}:${puuid}`, config.rankCacheSeconds * 1000, () =>
    request(platformHost(platform), `/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`)
  );

/** Drops cached ranks so the next lookup asks Riot again (used by the Refresh button). */
const forgetLeagueEntries = (platform, puuid) => cache.delete(`league:${platform}:${puuid}`);

const getTopMasteries = (platform, puuid, count = 3) =>
  cached(`mastery:${platform}:${puuid}:${count}`, 30 * MINUTE, () =>
    request(
      platformHost(platform),
      `/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(puuid)}/top?count=${count}`
    )
  );

// ---- Data Dragon (static game data, no API key or rate limit) --------------------------------

const DDRAGON = 'https://ddragon.leagueoflegends.com';

const fetchJson = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${url} responded with ${response.status}`);
  return response.json();
};

const getLatestVersion = () =>
  cached(
    'ddragon:version',
    6 * HOUR,
    async () => (await fetchJson(`${DDRAGON}/api/versions.json`))[0]
  );

/** Map of numeric champion id -> display name. */
const getChampionNames = () =>
  cached('ddragon:champions', 6 * HOUR, async () => {
    const version = await getLatestVersion();
    const { data } = await fetchJson(`${DDRAGON}/cdn/${version}/data/en_US/champion.json`);
    return new Map(Object.values(data).map((champion) => [Number(champion.key), champion.name]));
  });

const profileIconUrl = async (iconId) => {
  try {
    const version = await getLatestVersion();
    return `${DDRAGON}/cdn/${version}/img/profileicon/${iconId}.png`;
  } catch {
    return undefined;
  }
};

module.exports = {
  request,
  getAccountByRiotId,
  getAccountByPuuid,
  getActivePlatform,
  getSummoner,
  getLeagueEntries,
  forgetLeagueEntries,
  getTopMasteries,
  getLatestVersion,
  getChampionNames,
  profileIconUrl,
  _cache: cache,
  _limiters: limiters,
};
