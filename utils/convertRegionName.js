const convertRegionShortName = (shortName) => {
  let regionName = '';
  switch (shortName) {
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

module.exports = {
  convertRegionShortName,
};
