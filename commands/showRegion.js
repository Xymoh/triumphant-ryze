const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Sequelize = require('sequelize');

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

      let regionName = '';

      switch (serverConfig.region) {
        case 'BR1':
          regionName = 'Brazil';
          break;
        case 'EUN1':
          regionName = 'Europe Nordic & East';
          break;
        case 'EUW1':
          regionName = 'Europe West';
          break;
        case 'LA1':
          regionName = 'Latin America North';
          break;
        case 'LA2':
          regionName = 'Latin America South';
          break;
        case 'NA1':
          regionName = 'North America';
          break;
        case 'OC1':
          regionName = 'Oceania';
          break;
        case 'RU':
          regionName = 'Russia';
          break;
        case 'TR1':
          regionName = 'Turkey';
          break;
        case 'JP1':
          regionName = 'Japan';
          break;
        case 'KR':
          regionName = 'Republic of Korea';
          break;
        case 'PH2':
          regionName = 'The Philippines';
          break;
        case 'SG2':
          regionName = 'Singapore, Malaysia, & Indonesia';
          break;
        case 'TW2':
          regionName = 'Taiwan, Hong Kong, and Macao';
          break;
        case 'TH2':
          regionName = 'Thailand';
          break;
        case 'VN2':
          regionName = 'Vietnam';
          break;
        default:
          regionName = 'Unknown';
          break;
      }

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Currently Set Server Region')
        .setDescription(`The region set on this server is: ${regionName}`);

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(`Error fetching server config: ${error}`);
    }
  },
};
