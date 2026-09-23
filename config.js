const path = require('node:path');

// Load .env when present. In production (Docker, Railway, etc.) variables usually come from the
// environment directly, so a missing file is fine.
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

module.exports = {
  discordToken: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  // Register commands to a single server for instant updates while developing.
  devGuildId: process.env.DEV_GUILD_ID,

  // API_KEY is the old variable name, still accepted so existing deployments keep working.
  riotApiKey: process.env.RIOT_API_KEY || process.env.API_KEY,

  // Postgres connection string, e.g. postgres://user:password@localhost:5432/triumphant_ryze.
  // When empty, a local SQLite file is used instead (handy for development and small installs).
  databaseUrl: process.env.DATABASE_URL,
  // "true" = TLS with certificate verification, "no-verify" = TLS for hosts with self-signed certs.
  databaseSsl: process.env.DATABASE_SSL,
  sqlitePath: process.env.SQLITE_PATH || path.join(__dirname, 'data', 'bot.sqlite'),

  maxPlayersPerGuild: toInt(process.env.MAX_PLAYERS_PER_GUILD, 50),
  rankCacheSeconds: toInt(process.env.RANK_CACHE_SECONDS, 120),

  // Optional links shown in /help.
  websiteUrl: process.env.WEBSITE_URL,
  supportServerUrl: process.env.SUPPORT_SERVER_URL,
};
