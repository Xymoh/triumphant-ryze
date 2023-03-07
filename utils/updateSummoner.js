const Sequelize = require('sequelize');
const dotenv = require('dotenv');

const { fetchSummonerName } = require('./fetchRiotApi.js');

dotenv.config();

const updateSummonerName = async (summoner) => {
  // fetch riot api for summoner info
  const summonerName = await fetchSummonerName(
    summoner.riot_server,
    summoner.riot_id
  );

  // if summoner name has changed
  if (summonerName !== summoner.summoner_name) {
    console.log('summoner name has changed');
    console.log(`old name: ${summoner.summoner_name}`);
    console.log(`new name: ${summonerName}`);
    const sequelize = new Sequelize(process.env.DATABASE_URL);

    // summoners table
    const summoners = sequelize.define('summoners', {
      riot_id: Sequelize.STRING,
      guild_id: Sequelize.STRING,
      riot_server: Sequelize.STRING,
      summoner_name: Sequelize.STRING,
    });

    // change summoner name in database
    summoners.update(
      { summoner_name: summonerName },
      {
        where: {
          guild_id: summoner.guild_id,
          riot_id: summoner.riot_id,
        },
      }
    );
  }
};

module.exports = { updateSummonerName };
