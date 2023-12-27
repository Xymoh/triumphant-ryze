const Sequelize = require('sequelize');

const { sequelize } = require('./dbConnect.js');

const serverConfigs = sequelize.define(
  'server_configs',
  {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    guild_id: Sequelize.STRING,
    region: Sequelize.STRING,
  },
  {
    timestamps: false,
  }
);

const summoners = sequelize.define(
  'summoners',
  {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    puuid: Sequelize.STRING,
    summoner_id: Sequelize.STRING,
    guild_id: Sequelize.STRING,
    riot_server: Sequelize.STRING,
    summoner_name: Sequelize.STRING,
    tag_line: Sequelize.STRING,
  },
  {
    timestamps: false,
  }
);

const updateRegion = async (guildId, region) => {
  return await serverConfigs.update(
    {
      region: region,
    },
    {
      where: {
        guild_id: guildId,
      },
    }
  );
};

const getAllSummonersInDatabase = async (guildId) => {
  return await summoners.findAll({
    where: {
      guild_id: guildId,
    },
  });
};

const getServerConfig = async (guildId) => {
  return await serverConfigs.findOne({
    where: {
      guild_id: guildId,
    },
  });
};

const getSummonerExists = async (guildId, region, summonerName) => {
  return await summoners.findOne({
    where: {
      guild_id: guildId,
      riot_server: region,
      summoner_name: summonerName,
    },
  });
};

module.exports = {
  serverConfigs,
  getServerConfig,
  summoners,
  getSummonerExists,
  updateRegion,
  getAllSummonersInDatabase,
};
