const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const fetchSummonerId = async (region, summonerName) => {
  try {
    const response = await axios.get(
      `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${summonerName}?api_key=${process.env.API_KEY}`
    );
    const data = response.data;
    return data.id;
  } catch (error) {
    console.error(error);
  }
};

const fetchSummonerRanking = async (region, summonerId, ranked) => {
  try {
    const response = await axios.get(
      `https://${region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}?api_key=${process.env.API_KEY}`
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
  fetchSummonerId,
  fetchSummonerRanking,
};
