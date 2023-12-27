const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const regionMapping = {
  BR1: 'americas',
  EUN1: 'europe',
  EUW1: 'europe',
  LA1: 'americas',
  LA2: 'americas',
  NA1: 'americas',
  OC1: 'americas',
  RU: 'europe',
  TR1: 'europe',
  JP1: 'asia',
  KR: 'asia',
  PH2: 'asia',
  SG2: 'asia',
  TW2: 'asia',
  TH2: 'asia',
  VN2: 'asia',
};

const fetchPUUID = async (region, summonerName, tagLine) => {
  try {
    const mappedRegion = regionMapping[region];
    const response = await axios.get(
      `https://${mappedRegion}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${summonerName}/${tagLine}`,
      { headers: { 'X-Riot-Token': process.env.API_KEY } }
    );
    const data = response.data;
    return data.puuid;
  } catch (error) {
    console.error(error);
  }
};

const fetchSummonerByPUUID = async (region, puuid) => {
  try {
    const response = await axios.get(
      `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
      { headers: { 'X-Riot-Token': process.env.API_KEY } }
    );
    return response.data;
  } catch (error) {
    console.error(error);
    return null;
  }
};

const fetchSummonerRanking = async (region, summonerId, ranked) => {
  try {
    console.log(`fetchSummonerRanking: ${region} ${summonerId} ${ranked}`);
    const response = await axios.get(
      `https://${region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`,
      { headers: { 'X-Riot-Token': process.env.API_KEY } }
    );
    const data = response.data;
    let ranking = [];
    if (ranked === 'solo_duo') {
      for (let i = 0; i < data.length; i++) {
        if (data[i].queueType === 'RANKED_SOLO_5x5') {
          ranking.push(data[i]);
        }
      }
    } else if (ranked === 'flex') {
      for (let i = 0; i < data.length; i++) {
        if (data[i].queueType === 'RANKED_FLEX_SR') {
          ranking.push(data[i]);
        }
      }
    }
    return ranking;
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  fetchPUUID,
  fetchSummonerByPUUID,
  fetchSummonerRanking,
};
