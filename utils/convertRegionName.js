const convertRegionShortToLong = (shortRegion) => {
  let regionName = '';
  switch (shortRegion) {
    case 'BR1':
      regionName = 'Brazil';
      break;
    case 'EUN1':
      regionName = 'Europe Nordic & East';
      break;
    case 'EUW1':
      regionName = 'Europe West';
      break;
    case 'LA1':
      regionName = 'Latin America North';
      break;
    case 'LA2':
      regionName = 'Latin America South';
      break;
    case 'NA1':
      regionName = 'North America';
      break;
    case 'OC1':
      regionName = 'Oceania';
      break;
    case 'RU':
      regionName = 'Russia';
      break;
    case 'TR1':
      regionName = 'Turkey';
      break;
    case 'JP1':
      regionName = 'Japan';
      break;
    case 'KR':
      regionName = 'Republic of Korea';
      break;
    case 'PH2':
      regionName = 'The Philippines';
      break;
    case 'SG2':
      regionName = 'Singapore, Malaysia, & Indonesia';
      break;
    case 'TW2':
      regionName = 'Taiwan, Hong Kong, and Macao';
      break;
    case 'TH2':
      regionName = 'Thailand';
      break;
    case 'VN2':
      regionName = 'Vietnam';
      break;
    default:
      regionName = 'Unknown';
      break;
  }

  return regionName;
};

const convertRegionShortToOpgg = (shortRegion) => {
  let regionName = '';
  switch (shortRegion) {
    case 'BR1':
      regionName = 'br';
      break;
    case 'EUN1':
      regionName = 'eune';
      break;
    case 'EUW1':
      regionName = 'euw';
      break;
    case 'LA1':
      regionName = 'lan';
      break;
    case 'LA2':
      regionName = 'las';
      break;
    case 'NA1':
      regionName = 'na';
      break;
    case 'OC1':
      regionName = 'oce';
      break;
    case 'RU':
      regionName = 'ru';
      break;
    case 'TR1':
      regionName = 'tr';
      break;
    case 'JP1':
      regionName = 'jp';
      break;
    case 'KR':
      regionName = 'kr';
      break;
    case 'PH2':
      regionName = 'ph';
      break;
    case 'SG2':
      regionName = 'sg';
      break;
    case 'TW2':
      regionName = 'tw';
      break;
    case 'TH2':
      regionName = 'th';
      break;
    case 'VN2':
      regionName = 'vn';
      break;
    default:
      regionName = 'Unknown';
      break;
  }

  return regionName;
};

module.exports = {
  convertRegionShortToLong,
  convertRegionShortToOpgg,
};
