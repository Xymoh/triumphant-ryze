const { Events } = require('discord.js');

const { deleteGuildData, listStoredGuildIds } = require('../utils/db.js');
const { loadApplicationEmojis } = require('../utils/emojis.js');

/**
 * guildDelete only fires while the bot is online, so servers that removed it during downtime are
 * cleaned up here. If more than half of the stored servers look gone, the bot is most likely
 * running with the wrong token or database, and nothing is deleted.
 */
const pruneRemovedGuilds = async (client) => {
  if (client.shard) return; // each shard only sees its own servers

  const stored = await listStoredGuildIds();
  const removed = stored.filter((guildId) => !client.guilds.cache.has(guildId));
  if (removed.length === 0) return;

  if (removed.length > stored.length / 2) {
    console.warn(
      `[ready] ${removed.length}/${stored.length} stored servers are not joined; skipping cleanup (wrong token or database?)`
    );
    return;
  }

  for (const guildId of removed) await deleteGuildData(guildId);
  console.log(
    `[ready] Removed data for ${removed.length} server(s) that removed the bot while it was offline`
  );
};

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    const emojiCount = await loadApplicationEmojis(client);
    console.log(
      `[ready] Logged in as ${client.user.tag} · ${client.guilds.cache.size} servers · ${emojiCount} rank emojis`
    );
    await pruneRemovedGuilds(client);
  },
};
