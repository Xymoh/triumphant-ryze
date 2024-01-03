const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const getRegion = require('../utils/getRegion.js');
const { getAllSummonersInDatabase } = require('../utils/dbFunctions.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('show-all-summoners')
    .setDescription('Show all summoners in database with their region.'),
  async execute(interaction) {
    try {
      const allSummonersInDatabase = await getAllSummonersInDatabase(interaction.guild.id);
      const embed = new EmbedBuilder().setTitle('All Summoners').setColor('#0099ff');

      // if no summoners in database
      if (allSummonersInDatabase.length === 0) {
        embed.setDescription('No summoners in database.');

        // if summoners in database
      } else {
        embed.setDescription('All summoners in database.');

        allSummonersInDatabase.forEach((summoner) => {
          const region = getRegion(summoner.riot_server);
          embed.addFields({
            name: summoner.summoner_name,
            value: region,
          });
        });
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
    }
  },
};
