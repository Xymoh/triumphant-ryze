/**
 * Uploads the ranked crests in assets/ranks as application emojis ("rank_gold", ...).
 * Application emojis belong to the bot itself, so they work in every server it joins.
 * Run once:  npm run emojis        Replace existing ones:  npm run emojis -- --force
 */
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

const config = require('../config.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'ranks');

const main = async () => {
  if (!config.discordToken || !config.clientId) {
    throw new Error('DISCORD_TOKEN and CLIENT_ID must be set in .env');
  }

  const rest = new REST().setToken(config.discordToken);
  const force = process.argv.includes('--force');
  const { items } = await rest.get(Routes.applicationEmojis(config.clientId));
  const existing = new Map(items.map((emoji) => [emoji.name, emoji]));

  const files = fs.readdirSync(ASSETS).filter((file) => file.endsWith('.png'));
  for (const file of files) {
    const name = `rank_${path.basename(file, '.png')}`;
    const current = existing.get(name);
    if (current && !force) {
      console.log(`- ${name} already exists, skipping`);
      continue;
    }
    if (current) await rest.delete(Routes.applicationEmoji(config.clientId, current.id));

    const image = `data:image/png;base64,${fs.readFileSync(path.join(ASSETS, file)).toString('base64')}`;
    await rest.post(Routes.applicationEmojis(config.clientId), { body: { name, image } });
    console.log(`✓ uploaded ${name}`);
  }

  console.log('\nDone. Restart the bot so it picks up the emojis.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
