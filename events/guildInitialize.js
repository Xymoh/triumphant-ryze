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
      region: Sequelize.STRING,
      prefix: Sequelize.STRING,
    });

    try {
      const configData = await serverConfigs.create({
        guild_id: guild.id,
        region: 'EUN1',
        prefix: '/',
      });

      console.log(
        `Server config created for guild_id: ${configData.guild_id} (id: ${configData.id})`
      );
    } catch (error) {
      console.error(`Error creating server config: ${error}`);
    }
  },
};
