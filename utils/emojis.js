/**
 * Tier emojis. After the bot owner runs `npm run emojis` once, the bot owns application emojis
 * named "rank_gold", "rank_emerald", ... which render as real ranked crests in every server and
 * double as embed thumbnails (Discord hosts the images). Without them we fall back to Unicode.
 */
const FALLBACK = {
  IRON: '⚫',
  BRONZE: '🟤',
  SILVER: '⚪',
  GOLD: '🟡',
  PLATINUM: '🔵',
  EMERALD: '🟢',
  DIAMOND: '💎',
  MASTER: '🟣',
  GRANDMASTER: '🔴',
  CHALLENGER: '👑',
  UNRANKED: '▫️',
};

const applicationEmojis = new Map();

const loadApplicationEmojis = async (client) => {
  try {
    const emojis = await client.application.emojis.fetch();
    applicationEmojis.clear();
    for (const emoji of emojis.values()) {
      const match = /^rank_([a-z]+)$/i.exec(emoji.name);
      if (!match) continue;
      applicationEmojis.set(match[1].toUpperCase(), {
        mention: emoji.toString(),
        url: emoji.imageURL({ extension: 'png', size: 128 }),
      });
    }
  } catch (error) {
    console.warn('[emojis] Could not load application emojis, using fallbacks:', error.message);
  }
  return applicationEmojis.size;
};

const tierEmoji = (tier) =>
  applicationEmojis.get(tier)?.mention ?? FALLBACK[tier] ?? FALLBACK.UNRANKED;

/** Crest image URL for thumbnails, or null when the rank emojis haven't been uploaded. */
const tierImageUrl = (tier) => applicationEmojis.get(tier)?.url ?? null;

module.exports = { loadApplicationEmojis, tierEmoji, tierImageUrl, FALLBACK };
