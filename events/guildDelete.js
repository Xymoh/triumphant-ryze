const { Events } = require('discord.js');

const { deleteGuildData } = require('../utils/db.js');

// Only fires when the bot is kicked or the server is deleted (outages emit guildUnavailable), so
// it's safe to remove that server's data here.
module.exports = {
  name: Events.GuildDelete,
  async execute(guild) {
    const removedPlayers = await deleteGuildData(guild.id);
    console.log(
      `[guilds] Left ${guild.name} (${guild.id}); removed its settings and ${removedPlayers} tracked players`
    );
  },
};
