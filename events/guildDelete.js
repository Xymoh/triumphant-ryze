const { Events } = require('discord.js');

const { serverConfigs } = require('../utils/dbFunctions');

module.exports = {
  name: Events.GuildDelete,
  once: false,
  async execute(guild) {
    console.log(
      `Left a guild: ${guild.name} (id: ${guild.id}). This guild had ${guild.memberCount} members!`
    );

    try {
      await serverConfigs.destroy({
        where: {
          guild_id: guild.id,
        },
      });

      console.log(`Server config deleted: ${guild.id}`);
    } catch (error) {
      console.error(`Error deleting server config: ${error}`);
    }
  },
};
