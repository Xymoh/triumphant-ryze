const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Sequelize = require('sequelize');

const { convertRegionShortToLong } = require('../utils/convertRegionName.js');
const { sequelize } = require('../utils/dbConnect.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('show-region')
    .setDescription('Show the region of the server.'),
  async execute(interaction) {
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

    try {
      const serverConfig = await serverConfigs.findOne({
        where: {
          guild_id: interaction.guild.id,
        },
      });

      let regionName = convertRegionShortToLong(serverConfig.region);

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Currently Set Server Region')
        .setDescription(`The region set on this server is: **${regionName}**`);

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(`Error fetching server config: ${error}`);
    }
  },
};
