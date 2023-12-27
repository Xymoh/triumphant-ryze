const { Events } = require('discord.js');
const Sequelize = require('sequelize');

const { connectToDB, sequelize } = require('../utils/dbConnect.js');

module.exports = {
  name: Events.GuildCreate,
  once: false,
  async execute(guild) {
    console.log(
      `Joined a new guild: ${guild.name} (id: ${guild.id}). This guild has ${guild.memberCount} members!`
    );

    connectToDB();

    const serverConfigs = sequelize.define(
      'server_configs',
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        guild_id: Sequelize.STRING,
        region: Sequelize.STRING,
      },
      {
        timestamps: false,
        freezeTableName: true,
      }
    );

    try {
      const configData = await serverConfigs.create({
        guild_id: guild.id,
        region: 'EUN1',
      });

      console.log(
        `Server config created for guild_id: ${configData.guild_id} (id: ${configData.id})`
      );
    } catch (error) {
      console.error(`Error creating server config: ${error}`);
    }
  },
};
