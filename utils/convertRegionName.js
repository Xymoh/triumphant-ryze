const convertRegionShortToLong = (shortRegion) => {
  switch (shortRegion) {
    case 'BR1':
      return 'Brazil';
    case 'EUN1':
      return 'Europe Nordic & East';
    case 'EUW1':
      return 'Europe West';
    case 'LA1':
      return 'Latin America North';
    case 'LA2':
      return 'Latin America South';
    case 'NA1':
      return 'North America';
    case 'OC1':
      return 'Oceania';
    case 'RU':
      return 'Russia';
    case 'TR1':
      return 'Turkey';
    case 'JP1':
      return 'Japan';
    case 'KR':
      return 'Republic of Korea';
    case 'PH2':
      return 'The Philippines';
    case 'SG2':
      return 'Singapore, Malaysia, & Indonesia';
    case 'TW2':
      return 'Taiwan, Hong Kong, and Macao';
    case 'TH2':
      return 'Thailand';
    case 'VN2':
      return 'Vietnam';
    default:
      return 'Unknown';
  }
};

const convertRegionShortToOpgg = (shortRegion) => {
  switch (shortRegion) {
    case 'BR1':
      return 'br';
    case 'EUN1':
      return 'eune';
    case 'EUW1':
      return 'euw';
    case 'LA1':
      return 'lan';
    case 'LA2':
      return 'las';
    case 'NA1':
      return 'na';
    case 'OC1':
      return 'oce';
    case 'RU':
      return 'ru';
    case 'TR1':
      return 'tr';
    case 'JP1':
      return 'jp';
    case 'KR':
      return 'kr';
    case 'PH2':
      return 'ph';
    case 'SG2':
      return 'sg';
    case 'TW2':
      return 'tw';
    case 'TH2':
      return 'th';
    case 'VN2':
      return 'vn';
    default:
      return 'Unknown';
  }
};

module.exports = {
  convertRegionShortToLong,
  convertRegionShortToOpgg,
};
