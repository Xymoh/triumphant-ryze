const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Sequelize = require('sequelize');

const { convertRegionShortName } = require('../utils/convertRegionName.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('show-region')
    .setDescription('Show the region of the server.'),
  async execute(interaction) {
    const sequelize = new Sequelize(process.env.DATABASE_URL);

    const serverConfigs = sequelize.define('server_configs', {
      guild_id: Sequelize.STRING,
      region: Sequelize.STRING,
      prefix: Sequelize.STRING,
    });

    try {
      const serverConfig = await serverConfigs.findOne({
        where: {
          guild_id: interaction.guild.id,
        },
      });

      let regionName = convertRegionShortName(serverConfig.region);

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
