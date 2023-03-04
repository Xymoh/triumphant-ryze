const { Events } = require('discord.js');
const Sequelize = require('sequelize');

module.exports = {
  name: Events.GuildCreate,
  once: false,
  async execute(guild) {
    console.log(
      `Joined a new guild: ${guild.name} (id: ${guild.id}). This guild has ${guild.memberCount} members!`
    );

    const sequelize = new Sequelize(process.env.DATABASE_URL);

    const serverConfigs = sequelize.define('server_configs', {
      guild_id: Sequelize.STRING,
      prefix: Sequelize.STRING,
    });

    try {
      const configData = await serverConfigs.create({
        guild_id: guild.id,
        prefix: '/',
      });

      console.log(
        `New server config created for guild_id: ${serverConfigs.guild_id} (id: ${serverConfigs.id})`
      );
    } catch (error) {
      console.error(`Error creating server config: ${error}`);
    }
  },
};
