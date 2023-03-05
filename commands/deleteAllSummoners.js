const { SlashCommandBuilder } = require('discord.js');
const Sequelize = require('sequelize');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete-all-summoners')
    .setDescription('Delete all summoners from bot data.'),
  async execute(interaction) {
    try {
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
      await interaction.reply(
        'There was an error trying to delete all summoners from database.'
      );
    }
  },
};
