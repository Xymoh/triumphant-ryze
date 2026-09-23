/**
 * League of Legends servers ("platforms"). `accountRegion` is the regional cluster used for the
 * Riot Account API (any cluster can look up any account, the closest one is just faster).
 * `opgg` is the region slug op.gg and League of Graphs use in their URLs.
 *
 * Source: "execute against" lists on https://developer.riotgames.com/apis (the routing table on
 * the docs page is outdated).
 */
const PLATFORMS = [
  { id: 'BR1', label: 'BR', name: 'Brazil', opgg: 'br', accountRegion: 'americas' },
  {
    id: 'EUN1',
    label: 'EUNE',
    name: 'Europe Nordic & East',
    opgg: 'eune',
    accountRegion: 'europe',
  },
  { id: 'EUW1', label: 'EUW', name: 'Europe West', opgg: 'euw', accountRegion: 'europe' },
  { id: 'JP1', label: 'JP', name: 'Japan', opgg: 'jp', accountRegion: 'asia' },
  { id: 'KR', label: 'KR', name: 'Korea', opgg: 'kr', accountRegion: 'asia' },
  { id: 'LA1', label: 'LAN', name: 'Latin America North', opgg: 'lan', accountRegion: 'americas' },
  { id: 'LA2', label: 'LAS', name: 'Latin America South', opgg: 'las', accountRegion: 'americas' },
  { id: 'ME1', label: 'ME', name: 'Middle East', opgg: 'me', accountRegion: 'europe' },
  { id: 'NA1', label: 'NA', name: 'North America', opgg: 'na', accountRegion: 'americas' },
  { id: 'OC1', label: 'OCE', name: 'Oceania', opgg: 'oce', accountRegion: 'americas' },
  { id: 'RU', label: 'RU', name: 'Russia', opgg: 'ru', accountRegion: 'europe' },
  // Since January 2025 SG2 also hosts the former Philippines (PH2) and Thailand (TH2) servers.
  { id: 'SG2', label: 'SEA', name: 'Southeast Asia', opgg: 'sg', accountRegion: 'asia' },
  { id: 'TR1', label: 'TR', name: 'Türkiye', opgg: 'tr', accountRegion: 'europe' },
  { id: 'TW2', label: 'TW', name: 'Taiwan, Hong Kong & Macao', opgg: 'tw', accountRegion: 'asia' },
  { id: 'VN2', label: 'VN', name: 'Vietnam', opgg: 'vn', accountRegion: 'asia' },
];

const BY_ID = new Map(PLATFORMS.map((platform) => [platform.id, platform]));

const getPlatform = (id) => BY_ID.get(String(id).toUpperCase());

const regionChoices = () => PLATFORMS.map(({ id, name }) => ({ name, value: id }));

/**
 * Best guess for a new server's default region based on its Discord language. Most servers keep
 * the default "en-US", so admins can still change it with /settings.
 */
const LOCALE_REGIONS = {
  'pt-BR': 'BR1',
  'es-419': 'LA1',
  'en-US': 'NA1',
  'en-GB': 'EUW1',
  de: 'EUW1',
  fr: 'EUW1',
  'es-ES': 'EUW1',
  it: 'EUW1',
  nl: 'EUW1',
  pl: 'EUN1',
  cs: 'EUN1',
  hu: 'EUN1',
  ro: 'EUN1',
  el: 'EUN1',
  bg: 'EUN1',
  hr: 'EUN1',
  lt: 'EUN1',
  fi: 'EUN1',
  no: 'EUN1',
  'sv-SE': 'EUN1',
  da: 'EUN1',
  uk: 'EUN1',
  ru: 'RU',
  tr: 'TR1',
  ja: 'JP1',
  ko: 'KR',
  'zh-TW': 'TW2',
  vi: 'VN2',
  th: 'SG2',
  id: 'SG2',
};

const DEFAULT_REGION = 'EUW1';

const defaultRegionForLocale = (locale) => LOCALE_REGIONS[locale] ?? DEFAULT_REGION;

/** Link buttons for a player's profile on popular stat sites. */
const profileLinks = (platformId, gameName, tagLine) => {
  const platform = getPlatform(platformId);
  if (!platform || !gameName || !tagLine) return [];
  const slug = encodeURIComponent(`${gameName}-${tagLine}`);
  return [
    { label: 'OP.GG', url: `https://op.gg/lol/summoners/${platform.opgg}/${slug}` },
    {
      label: 'U.GG',
      url: `https://u.gg/lol/profile/${platform.id.toLowerCase()}/${slug}/overview`,
    },
    {
      label: 'League of Graphs',
      url: `https://www.leagueofgraphs.com/summoner/${platform.opgg}/${slug}`,
    },
  ];
};

const profileUrl = (platformId, gameName, tagLine) =>
  profileLinks(platformId, gameName, tagLine)[0]?.url ?? null;

module.exports = {
  PLATFORMS,
  getPlatform,
  regionChoices,
  defaultRegionForLocale,
  profileLinks,
  profileUrl,
};
