const getRegion = (regionName) => {
  switch (regionName) {
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

module.exports = getRegion;
