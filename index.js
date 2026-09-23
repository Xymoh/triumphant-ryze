const { ActivityType, Client, Collection, GatewayIntentBits } = require('discord.js');

const config = require('./config.js');
const { initDatabase, closeDatabase } = require('./utils/db.js');
const { loadModules, loadCommands } = require('./utils/loadModules.js');

const main = async () => {
  if (!config.discordToken) {
    throw new Error('DISCORD_TOKEN is not set. Copy .env.example to .env and fill it in.');
  }
  if (!config.riotApiKey) {
    console.warn('[startup] RIOT_API_KEY is not set, so every Riot lookup will fail.');
  }

  await initDatabase();
  console.log(`[db] Ready (${config.databaseUrl ? 'postgres' : `sqlite: ${config.sqlitePath}`})`);

  // Slash commands only need the Guilds intent; no message content or member data is read.
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    presence: {
      activities: [{ name: 'status', type: ActivityType.Custom, state: '🏆 /ranking · /help' }],
    },
  });

  client.commands = new Collection(loadCommands().map((command) => [command.data.name, command]));

  for (const { module: event } of loadModules('events')) {
    const listener = (...args) =>
      Promise.resolve()
        .then(() => event.execute(...args))
        .catch((error) => console.error(`[event] ${event.name} handler failed:`, error));
    client[event.once ? 'once' : 'on'](event.name, listener);
  }

  const shutdown = async (signal) => {
    console.log(`[shutdown] Received ${signal}, closing connections...`);
    await client.destroy();
    await closeDatabase();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  process.on('unhandledRejection', (error) => console.error('[unhandledRejection]', error));

  await client.login(config.discordToken);
};

main().catch((error) => {
  console.error('[startup] Failed to start the bot:', error);
  process.exit(1);
});
