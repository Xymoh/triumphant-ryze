const { EmbedBuilder, Events, PermissionFlagsBits } = require('discord.js');

const { ensureGuildConfig } = require('../utils/db.js');
const { COLORS, BOT_NAME } = require('../utils/embeds.js');
const { defaultRegionForLocale, getPlatform } = require('../utils/regions.js');

const WELCOME_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
];

const sendWelcome = async (guild, region) => {
  const channel = guild.systemChannel;
  const me = guild.members.me;
  if (!channel || !me || !channel.permissionsFor(me)?.has(WELCOME_PERMISSIONS)) return;

  const embed = new EmbedBuilder()
    .setColor(COLORS.brand)
    .setTitle(`Thanks for adding ${BOT_NAME}! 🏆`)
    .setDescription(
      [
        'Track your friends’ League of Legends ranks and find out who is really the best.',
        '',
        '**Get started**',
        '1. `/player add Name#TAG` for everyone in your group',
        '2. `/ranking` to see the leaderboard',
        '',
        `Default region: **${getPlatform(region).name}**. Admins can change it with \`/settings\`.`,
        'Use `/help` for all commands.',
      ].join('\n')
    );

  await channel.send({ embeds: [embed] }).catch(() => {});
};

module.exports = {
  name: Events.GuildCreate,
  async execute(guild) {
    console.log(`[guilds] Joined ${guild.name} (${guild.id}), ${guild.memberCount} members`);
    const [guildConfig, created] = await ensureGuildConfig(
      guild.id,
      defaultRegionForLocale(guild.preferredLocale)
    );
    if (created) await sendWelcome(guild, guildConfig.region);
  },
};
