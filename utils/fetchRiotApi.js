const dotenv = require('dotenv');

dotenv.config();

const fetchSummonerId = async (region, summonerName) => {
  try {
    const response = await fetch(
      `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${summonerName}?api_key=${process.env.API_KEY}`
    );
    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  fetchSummonerId,
};
