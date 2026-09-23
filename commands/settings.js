const {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const config = require('../config.js');
const { countPlayers, setGuildRegion } = require('../utils/db.js');
const { COLORS } = require('../utils/embeds.js');
const { UserError } = require('../utils/errors.js');
const { settingsFor } = require('../utils/players.js');
const { getPlatform, regionChoices } = require('../utils/regions.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('View or change the bot settings for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('region')
        .setDescription('Default region used when adding players')
        .addChoices(...regionChoices())
    ),

  async execute(interaction) {
    const newRegion = interaction.options.getString('region');
    if (newRegion && !getPlatform(newRegion)) throw new UserError('Unknown region.');
    if (newRegion) await setGuildRegion(interaction.guildId, newRegion);

    const [settings, playerCount] = await Promise.all([
      settingsFor(interaction),
      countPlayers(interaction.guildId),
    ]);
    const region = getPlatform(settings.region);

    const embed = new EmbedBuilder()
      .setColor(COLORS.brand)
      .setTitle('⚙️ Server settings')
      .addFields(
        { name: 'Default region', value: `${region.name} (\`${region.label}\`)`, inline: true },
        {
          name: 'Players tracked',
          value: `${playerCount} / ${config.maxPlayersPerGuild}`,
          inline: true,
        }
      )
      .setFooter({ text: 'Change the region with /settings region:<region>' });

    if (newRegion) {
      embed.setDescription(
        `✅ Default region changed to **${region.name}**.\nPlayers already on the leaderboard keep their own region.`
      );
    }

    // Changes are announced to everyone; simply viewing the settings stays private.
    await interaction.reply({
      embeds: [embed],
      flags: newRegion ? undefined : MessageFlags.Ephemeral,
    });
  },
};
