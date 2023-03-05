const { SlashCommandBuilder } = require('discord.js');
const Sequelize = require('sequelize');

const { fetchSummonerId } = require('../utils/fetchRiotApi.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-summoner')
    .setDescription('Add a summoner to bot data.')
    .addStringOption((option) =>
      option
        .setName('summoner')
        .setDescription('Summoner name')
        .setRequired(true)
    ),
  async execute(interaction) {
    try {
      const summoner = interaction.options.getString('summoner');

      const sequelize = new Sequelize(process.env.DATABASE_URL);

      // summoners table
      const summoners = sequelize.define('summoners', {
        riot_id: Sequelize.STRING,
        guild_id: Sequelize.STRING,
        riot_server: Sequelize.STRING,
        summoner_name: Sequelize.STRING,
      });

      // fetch region from database
      const serverConfigs = sequelize.define('server_configs', {
        guild_id: Sequelize.STRING,
        region: Sequelize.STRING,
        prefix: Sequelize.STRING,
      });

      const serverConfig = await serverConfigs.findOne({
        where: {
          guild_id: interaction.guild.id,
        },
      });

      const region = serverConfig.region;

      // if summoner already exists in database within the guild with the same region
      const summonerExists = await summoners.findOne({
        where: {
          guild_id: interaction.guild.id,
          riot_server: region,
          summoner_name: summoner,
        },
      });

      if (summonerExists) {
        await interaction.reply(
          `Summoner **${summoner}** already exists in database.`
        );
        return;
      }

      // fetch api from riot to get summoner id
      const summonerId = await fetchSummonerId(region, summoner);

      if (!summonerId) {
        await interaction.reply(
          `Summoner **${summoner}** not found on **${region}**.`
        );
        return;
      }

      // add summoner to database
      await summoners.create({
        riot_id: summonerId,
        guild_id: interaction.guild.id,
        riot_server: region,
        summoner_name: summoner,
      });

      await interaction.reply(`Summoner **${summoner}** added to database.`);
    } catch (error) {
      console.error(error);
    }
  },
};
