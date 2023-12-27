const { SlashCommandBuilder } = require('discord.js');

const { convertRegionShortToLong } = require('../utils/convertRegionName.js');
const { updateRegion } = require('../utils/dbFunctions.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('change-region')
    .setDescription('Change the region of the server')
    .addStringOption((option) =>
      option
        .setName('region')
        .setDescription('The region to change to')
        .setRequired(true)
        .addChoices(
          { name: 'Brazil', value: 'BR1' }, // BR
          { name: 'Europe Nordic & East', value: 'EUN1' }, // EUNE
          { name: 'Europe West', value: 'EUW1' }, // EUW
          { name: 'Latin America North', value: 'LA1' }, // LAN
          { name: 'Latin America South', value: 'LA2' }, // LAS
          { name: 'North America', value: 'NA1' }, // NA
          { name: 'Oceania', value: 'OC1' }, // OCE
          { name: 'Russia', value: 'RU' }, // RU
          { name: 'Turkey', value: 'TR1' }, // TR
          { name: 'Japan', value: 'JP1' }, // JP
          { name: 'Republic of Korea', value: 'KR' }, // KR
          { name: 'The Philippines', value: 'PH2' }, // PH
          { name: 'Singapore, Malaysia, & Indonesia', value: 'SG2' }, // SG
          { name: 'Taiwan, Hong Kong, and Macao', value: 'TW2' }, // TW
          { name: 'Thailand', value: 'TH2' }, // TH
          { name: 'Vietnam', value: 'VN2' } // VN
        )
    ),
  async execute(interaction) {
    try {
      const configData = await updateRegion(
        interaction.guild.id,
        interaction.options.getString('region')
      );

      console.log(`Updated server config: ${configData}`);
    } catch (error) {
      console.error(`Error updating server config: ${error}`);
    }

    await interaction.reply(
      `Region changed to **${convertRegionShortToLong(interaction.options.getString('region'))}**`
    );
  },
};
