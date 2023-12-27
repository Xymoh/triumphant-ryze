const { SlashCommandBuilder } = require('discord.js');

const { getServerConfig, summoners } = require('../utils/dbFunctions.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete-all-summoners')
    .setDescription('Delete all summoners from bot data.'),
  async execute(interaction) {
    try {
      const serverConfig = await getServerConfig(interaction.guild.id);
      const region = serverConfig.region;

      await summoners.destroy({
        where: {
          guild_id: interaction.guild.id,
          riot_server: region,
        },
      });

      await interaction.reply(
        `All summoners deleted from database for server **${interaction.guild.name}**.`
      );
    } catch (error) {
      console.error(error);
      await interaction.reply('There was an error trying to delete all summoners from database.');
    }
  },
};
