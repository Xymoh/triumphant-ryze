const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Sequelize = require('sequelize');

const getRegion = require('../utils/getRegion.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('show-all-summoners')
    .setDescription('Show all summoners in database with their region.'),
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

      const allSummoners = await summoners.findAll({
        where: {
          guild_id: interaction.guild.id,
        },
      });

      const embed = new EmbedBuilder()
        .setTitle('All Summoners')
        .setColor(0x00ff00);

      // if no summoners in database
      if (allSummoners.length === 0) {
        embed.setDescription('No summoners in database.');

        // if summoners in database
      } else {
        embed.setDescription('All summoners in database.');

        allSummoners.forEach((summoner) => {
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
