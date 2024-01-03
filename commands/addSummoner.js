const { SlashCommandBuilder } = require('discord.js');

const { fetchPUUID, fetchSummonerByPUUID } = require('../utils/fetchRiotApi.js');
const { getServerConfig, getSummonerExists, summoners } = require('../utils/dbFunctions.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-summoner')
    .setDescription('Add a summoner to bot data.')
    .addStringOption((option) =>
      option.setName('summoner').setDescription('Summoner name').setRequired(true)
    ),
  async execute(interaction) {
    try {
      const summonerInput = interaction.options.getString('summoner');
      const [summonerName, tagLine] = summonerInput.split('#');
      const serverConfig = await getServerConfig(interaction.guild.id);
      const region = serverConfig.region;

      // if summoner already exists in database within the guild with the same region
      const summonerExists = await getSummonerExists(interaction.guild.id, region, summonerName);

      if (summonerExists) {
        await interaction.reply(`Summoner **${summonerName}** already exists in database.`);
        return;
      }

      // fetch api from riot to get PUUID
      const puuid = await fetchPUUID(region, summonerName, tagLine);

      if (!puuid) {
        await interaction.reply(`Summoner **${summonerName}** not found on **${region}**.`);
        return;
      }

      // fetch summoner data by PUUID
      const summonerData = await fetchSummonerByPUUID(region, puuid);

      if (!summonerData || summonerData.puuid !== puuid) {
        await interaction.reply(`Summoner **${summonerName}** not found on **${region}**.`);
        return;
      }

      // add summoner to database
      await summoners.create({
        puuid: puuid,
        summoner_id: summonerData.id,
        guild_id: interaction.guild.id,
        riot_server: region,
        summoner_name: summonerName,
        tag_line: tagLine,
      });

      await interaction.reply(`Summoner **${summonerName}** added to database.`);
    } catch (error) {
      console.error(error);
    }
  },
};
