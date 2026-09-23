const riot = require('./riot.js');
const { mapWithConcurrency } = require('./concurrency.js');
const { RiotApiError, UserError } = require('./errors.js');
const { findPlayerById, findPlayerByRiotId, getGuildConfig, listPlayers } = require('./db.js');
const { defaultRegionForLocale, getPlatform } = require('./regions.js');
const { formatRiotId, parseRiotId } = require('./riotId.js');

const RIOT_ID_REFRESH_MS = 24 * 60 * 60 * 1000;

const isNotFound = (error) => error instanceof RiotApiError && error.status === 404;

/**
 * Resolves a Riot ID to an account and the server (platform) its League profile lives on.
 * `requested` is the region the user picked explicitly; otherwise we ask Riot where the player is
 * active and finally fall back to the server's default region.
 */
const lookupPlayer = async (riotId, { requested, fallback }) => {
  if (requested && !getPlatform(requested)) throw new UserError('Unknown region.');
  const accountRegion = getPlatform(requested ?? fallback)?.accountRegion ?? 'europe';

  let account;
  try {
    account = await riot.getAccountByRiotId(riotId.gameName, riotId.tagLine, accountRegion);
  } catch (error) {
    // Riot answers 400 instead of 404 for some malformed names.
    if (isNotFound(error) || (error instanceof RiotApiError && error.status === 400)) {
      throw new UserError(
        `Couldn't find **${formatRiotId(riotId.gameName, riotId.tagLine)}**. Check the spelling and the tag after the #.`
      );
    }
    throw error;
  }

  const platform =
    requested ?? (await riot.getActivePlatform(account.puuid, accountRegion)) ?? fallback;

  let summoner;
  try {
    summoner = await riot.getSummoner(platform, account.puuid);
  } catch (error) {
    if (isNotFound(error)) {
      throw new UserError(
        `**${formatRiotId(account.gameName, account.tagLine)}** has no League of Legends profile on **${getPlatform(platform).name}**. Try again with the \`region\` option.`
      );
    }
    throw error;
  }

  return { account, platform, summoner };
};

/**
 * Finds a tracked player from command input: either an autocomplete value ("id:12") or a typed
 * Riot ID. Returns null if the input is a Riot ID that isn't tracked here.
 */
const findTrackedPlayer = async (guildId, input) => {
  const idMatch = /^id:(\d+)$/.exec(input);
  if (idMatch) return findPlayerById(guildId, Number(idMatch[1]));
  return findPlayerByRiotId(guildId, parseRiotId(input));
};

/** The server's settings for a command, created with a language-based region if missing. */
const settingsFor = (interaction) =>
  getGuildConfig(interaction.guildId, defaultRegionForLocale(interaction.guildLocale));

/** Autocomplete choices for tracked players matching what the user has typed so far. */
const trackedPlayerChoices = async (guildId, query) => {
  const needle = query.trim().toLowerCase();
  const players = await listPlayers(guildId);
  return players
    .map((player) => ({ player, label: formatRiotId(player.gameName, player.tagLine) }))
    .filter(({ label }) => label.toLowerCase().includes(needle))
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, 25)
    .map(({ player, label }) => ({
      name: `${label} (${getPlatform(player.platform)?.label ?? player.platform})`.slice(0, 100),
      value: `id:${player.id}`,
    }));
};

/**
 * Players can change their Riot ID, which would break profile links. Once a day per player we ask
 * Riot for the current name. Rows saved by very old versions (no PUUID) get their PUUID filled in.
 */
const refreshRiotIds = async (players) => {
  const now = Date.now();
  const stale = players.filter(
    (player) =>
      (player.puuid || player.tagLine) &&
      (!player.riotIdCheckedAt || now - player.riotIdCheckedAt.getTime() > RIOT_ID_REFRESH_MS)
  );

  await mapWithConcurrency(stale, 2, async (player) => {
    const accountRegion = getPlatform(player.platform)?.accountRegion ?? 'europe';
    try {
      const account = player.puuid
        ? await riot.getAccountByPuuid(player.puuid, accountRegion)
        : await riot.getAccountByRiotId(player.gameName, player.tagLine, accountRegion);
      await player.update({
        puuid: account.puuid,
        gameName: account.gameName,
        tagLine: account.tagLine,
        riotIdCheckedAt: new Date(),
      });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        // An old row for an account that is already tracked in this server.
        await player.destroy();
      } else if (isNotFound(error)) {
        await player.update({ riotIdCheckedAt: new Date() });
      } else {
        console.warn(`[players] Could not refresh Riot ID for player ${player.id}:`, error.message);
      }
    }
  });
};

module.exports = {
  lookupPlayer,
  findTrackedPlayer,
  settingsFor,
  trackedPlayerChoices,
  refreshRiotIds,
};
