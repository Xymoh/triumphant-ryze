/**
 * Registers the slash commands with Discord.
 *
 *   npm run deploy                 -> global commands (all servers, can take a few minutes to show)
 *   npm run deploy -- --guild      -> only DEV_GUILD_ID (updates instantly, for testing)
 *   npm run deploy -- --clear-guild -> removes the test-server copies again
 */
const { REST, Routes } = require('discord.js');

const config = require('./config.js');
const { loadCommands } = require('./utils/loadModules.js');

const args = new Set(process.argv.slice(2));

const main = async () => {
  if (!config.discordToken || !config.clientId) {
    throw new Error('DISCORD_TOKEN and CLIENT_ID must be set in .env');
  }

  const rest = new REST().setToken(config.discordToken);
  const toGuild = args.has('--guild') || args.has('--clear-guild');

  if (toGuild && !config.devGuildId) throw new Error('Set DEV_GUILD_ID in .env first.');

  const route = toGuild
    ? Routes.applicationGuildCommands(config.clientId, config.devGuildId)
    : Routes.applicationCommands(config.clientId);
  const body = args.has('--clear-guild')
    ? []
    : loadCommands().map((command) => command.data.toJSON());

  console.log(
    `Registering ${body.length} command(s) ${toGuild ? `to server ${config.devGuildId}` : 'globally'}...`
  );
  const data = await rest.put(route, { body });
  console.log(`Done: ${data.length} command(s) registered.`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
