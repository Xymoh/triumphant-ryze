const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  OAuth2Scopes,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const config = require('../config.js');
const { BOT_NAME, COLORS, LEGAL_NOTICE } = require('../utils/embeds.js');

// Everything the bot needs: post the welcome message and use its rank emojis.
const INVITE_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.UseExternalEmojis,
];

const COMMANDS = [
  ['/ranking [queue]', 'Server leaderboard for Solo/Duo or Flex'],
  ['/profile <player>', 'Ranks and top champions of any player'],
  ['/player add <Name#TAG>', 'Add a friend (optionally link their Discord)'],
  ['/player remove | list', 'Manage who is on the leaderboard'],
  ['/player clear', 'Remove everyone *(Manage Server)*'],
  ['/settings', 'Default region for this server *(Manage Server)*'],
];

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription(`How to use ${BOT_NAME}.`),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.brand)
      .setTitle(`🏆 ${BOT_NAME}`)
      .setDescription(
        'Compare League of Legends ranks with your friends and settle who is really the best.'
      )
      .addFields(
        {
          name: 'Getting started',
          value:
            '1. `/player add Name#TAG` for everyone in your group\n2. `/ranking` to see the leaderboard',
        },
        {
          name: 'Commands',
          value: COMMANDS.map(([usage, text]) => `\`${usage}\` · ${text}`).join('\n'),
        },
        {
          name: 'Good to know',
          value:
            'Ranks refresh every couple of minutes. Each player keeps their own region, so friends from different servers can share one leaderboard. Admins can limit who may use each command in **Server Settings → Integrations**.',
        }
      )
      .setFooter({ text: LEGAL_NOTICE });

    const links = [
      [
        'Invite',
        interaction.client.generateInvite({
          scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
          permissions: INVITE_PERMISSIONS,
        }),
      ],
      ['Website', config.websiteUrl],
      ['Support server', config.supportServerUrl],
    ].filter(([, url]) => url);

    const buttons = new ActionRowBuilder().addComponents(
      links.map(([label, url]) =>
        new ButtonBuilder().setLabel(label).setURL(url).setStyle(ButtonStyle.Link)
      )
    );

    await interaction.reply({
      embeds: [embed],
      components: [buttons],
      flags: MessageFlags.Ephemeral,
    });
  },
};
