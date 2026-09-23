const { EmbedBuilder } = require('discord.js');

const COLORS = {
  brand: 0xc4a15b,
  success: 0x3ba55c,
  error: 0xed4245,
  warning: 0xfaa61a,
};

const BOT_NAME = 'Triumphant Ryze';

// Required by Riot's developer policies ("Legal Jibber Jabber") for any product using their API.
const LEGAL_NOTICE = `${BOT_NAME} isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.`;

const errorEmbed = (message) =>
  new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${message}`);

const successEmbed = (message) =>
  new EmbedBuilder().setColor(COLORS.success).setDescription(`✅ ${message}`);

const warningEmbed = (message) =>
  new EmbedBuilder().setColor(COLORS.warning).setDescription(`⚠️ ${message}`);

module.exports = { COLORS, BOT_NAME, LEGAL_NOTICE, errorEmbed, successEmbed, warningEmbed };
