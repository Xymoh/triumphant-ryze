const { Events } = require('discord.js');
const Sequelize = require('sequelize');

module.exports = {
  name: Events.GuildDelete,
  once: false,
  async execute(guild) {
    console.log(
      `Left a guild: ${guild.name} (id: ${guild.id}). This guild had ${guild.memberCount} members!`
    );

    const sequelize = new Sequelize(process.env.DATABASE_URL);

    const serverConfigs = sequelize.define('server_configs', {
      guild_id: Sequelize.STRING,
      region: Sequelize.STRING,
      prefix: Sequelize.STRING,
    });

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
