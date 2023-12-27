const { SlashCommandBuilder } = require('discord.js');

const { summoners, getServerConfig, getSummonerExists } = require('../utils/dbFunctions.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete-summoner')
    .setDescription('Delete a summoner from bot data.')
    .addStringOption((option) =>
      option.setName('summoner').setDescription('Summoner name').setRequired(true)
    ),
  async execute(interaction) {
    try {
      const summoner = interaction.options.getString('summoner');
      const serverConfig = await getServerConfig(interaction.guild.id);
      const region = serverConfig.region;

      // if summoner already exists in database within the guild with the same region
      const summonerExists = await getSummonerExists(interaction.guild.id, region, summoner);

      if (!summonerExists) {
        await interaction.reply(`Summoner **${summoner}** does not exist in database.`);
        return;
      }

      await summoners.destroy({
        where: {
          guild_id: interaction.guild.id,
          riot_server: region,
          summoner_name: summoner,
        },
      });

      await interaction.reply(`Summoner **${summoner}** has been deleted from database.`);
    } catch (error) {
      console.error(error);
    }
  },
};
