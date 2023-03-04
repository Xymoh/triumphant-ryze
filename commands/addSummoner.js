const { SlashCommandBuilder } = require('discord.js');
const Sequelize = require('sequelize');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addSummoner')
    .setDescription('Add a summoner to bot data.')
    .addStringOption((option) =>
      option
        .setName('summoner')
        .setDescription('Summoner name')
        .setRequired(true)
    ),
  async execute(interaction) {
    const summoner = interaction.options.getString('summoner');

    const sequelize = new Sequelize(process.env.DATABASE_URL);

    const summoners = sequelize.define('summoners', {
      summoner_name: Sequelize.STRING,
      discord_id: Sequelize.STRING,
    });

    await interaction.reply(`Summoner ${summoner} added!`);
  },
};
