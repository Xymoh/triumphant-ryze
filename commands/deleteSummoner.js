const { SlashCommandBuilder } = require('discord.js');
const Sequelize = require('sequelize');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete-summoner')
    .setDescription('Delete a summoner from bot data.')
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

      if (!summonerExists) {
        await interaction.reply(
          `Summoner **${summoner}** does not exist in database.`
        );
        return;
      }

      await summoners.destroy({
        where: {
          guild_id: interaction.guild.id,
          riot_server: region,
          summoner_name: summoner,
        },
      });

      await interaction.reply(
        `Summoner **${summoner}** has been deleted from database.`
      );
    } catch (error) {
      console.error(error);
    }
  },
};
