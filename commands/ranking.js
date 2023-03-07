const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Sequelize = require('sequelize');

const { convertRegionShortToOpgg } = require('../utils/convertRegionName.js');
const { fetchSummonerRanking } = require('../utils/fetchRiotApi.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('Show ranking of summoners in database.')
    .addStringOption((option) =>
      option
        .setName('ranked')
        .setDescription('Show ranked or flex ranking.')
        .setRequired(true)
        .addChoices(
          { name: 'Solo/Duo', value: 'solo_duo' },
          { name: 'Flex', value: 'flex' }
        )
    ),
  async execute(interaction) {
    try {
      const ranked = interaction.options.getString('ranked');

      const sequelize = new Sequelize(process.env.DATABASE_URL);

      // summoners table
      const summoners = sequelize.define('summoners', {
        riot_id: Sequelize.STRING,
        guild_id: Sequelize.STRING,
        riot_server: Sequelize.STRING,
        summoner_name: Sequelize.STRING,
      });

      // fetch region from database
      const serverConfigs = sequelize.define('server_configs', {
        guild_id: Sequelize.STRING,
        region: Sequelize.STRING,
        prefix: Sequelize.STRING,
      });

      const serverConfig = await serverConfigs.findOne({
        where: {
          guild_id: interaction.guild.id,
        },
      });

      const region = serverConfig.region;

      // fetch all summoners from database
      const allSummonersInDatabase = await summoners.findAll({
        where: {
          guild_id: interaction.guild.id,
        },
      });

      // if no summoners in database
      if (allSummonersInDatabase.length === 0) {
        await interaction.reply(
          `No summoners in database. Use **/add-summoner <summoner_name>** to add summoners.`
        );
        return;
      }

      // fetch summoners from database with the same region
      const summonersInDatabase = await summoners.findAll({
        where: {
          guild_id: interaction.guild.id,
          riot_server: region,
        },
      });

      // if no summoners in database with the same region
      if (summonersInDatabase.length === 0) {
        await interaction.reply(
          `No summoners in database with the same region as set on the server. Use **/add-summoner <summoner_name>** to add summoners.`
        );
        return;
      }

      let sortedSummoners = [];
      // loop through summoners and fetch their ranking
      for (let i = 0; i < summonersInDatabase.length; i++) {
        const summoner = summonersInDatabase[i];

        const summonerRanking = await fetchSummonerRanking(
          region,
          summoner.riot_id,
          ranked
        );

        // if summonerRanking is empty, push unranked
        if (summonerRanking.length === 0) {
          sortedSummoners.push({
            summonerName: summoner.summoner_name,
            tier: 'UNRANKED',
            rank: '',
            leaguePoints: 0,
            wins: 0,
            losses: 0,
            winRatio: 0,
          });
        } else {
          sortedSummoners.push({
            summonerName: summoner.summoner_name,
            tier: summonerRanking[0].tier,
            rank: summonerRanking[0].rank,
            leaguePoints: summonerRanking[0].leaguePoints,
            wins: summonerRanking[0].wins,
            losses: summonerRanking[0].losses,
            winRatio: (
              (summonerRanking[0].wins /
                (summonerRanking[0].wins + summonerRanking[0].losses)) *
              100
            ).toFixed(0),
          });
        }
      }

      // sort summoners by rank, tier and league points (descending)
      const order = [
        'CHALLENGER',
        'GRANDMASTER',
        'MASTER',
        'DIAMOND',
        'PLATINUM',
        'GOLD',
        'SILVER',
        'BRONZE',
        'IRON',
        'UNRANKED',
      ];
      const pos = {};
      for (let i = 0; i < order.length; i++) {
        pos[order[i]] = i;
      }
      sortedSummoners.sort((a, b) => {
        if (pos[a.tier] < pos[b.tier]) {
          return -1;
        } else if (pos[a.tier] > pos[b.tier]) {
          return 1;
        } else {
          if (a.rank < b.rank) {
            return -1;
          } else if (a.rank > b.rank) {
            return 1;
          } else {
            return b.leaguePoints - a.leaguePoints;
          }
        }
      });

      // create embed
      const embed = new EmbedBuilder()
        .setTitle(`Ranking for **${interaction.guild.name}**`)
        .setColor('#0099ff')
        .setTimestamp()
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.avatarURL(),
        })
        .setThumbnail(
          'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/764bbd9c-6d80-481d-8136-96848f01e843/ddx6q22-c6936a5b-73d6-409d-b248-0b370494f90f.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiJcL2ZcLzc2NGJiZDljLTZkODAtNDgxZC04MTM2LTk2ODQ4ZjAxZTg0M1wvZGR4NnEyMi1jNjkzNmE1Yi03M2Q2LTQwOWQtYjI0OC0wYjM3MDQ5NGY5MGYucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.YO0hLY0-_T-ehy8SwGRMUoi5jUOh0iQ-pCethcaLLK4'
        );

      // loop through sorted summoners and add them to embed
      // if summoner is 1st, 2nd or 3rd, add a crown emoji
      for (let i = 0; i < sortedSummoners.length; i++) {
        const summoner = sortedSummoners[i];
        let linkRegion = convertRegionShortToOpgg(region);
        // encode summoner name to link
        const encodedSummonerName = encodeURIComponent(summoner.summonerName);
        // convert summoner name to link using javascript template literals
        const link = `[${summoner.summonerName}](https://www.op.gg/summoners/${linkRegion}/${encodedSummonerName})`;

        // First place
        if (i === 0) {
          embed.addFields({
            name: `\u200b`,
            value: `${i + 1}. **${link}** 🥇 **${summoner.tier} ${
              summoner.rank
            } ${summoner.leaguePoints} LP** - ${summoner.wins}W ${
              summoner.losses
            }L / WR ${summoner.winRatio}%`,
          });
        }
        // Second place
        if (i === 1) {
          embed.addFields({
            name: `\u200b`,
            value: `${i + 1}. **${link}** 🥈 **${summoner.tier} ${
              summoner.rank
            } ${summoner.leaguePoints} LP** - ${summoner.wins}W ${
              summoner.losses
            }L / WR ${summoner.winRatio}%`,
          });
        }
        // Third place
        if (i === 2) {
          embed.addFields({
            name: `\u200b`,
            value: `${i + 1}. **${link}** 🥉 **${summoner.tier} ${
              summoner.rank
            } ${summoner.leaguePoints} LP** - ${summoner.wins}W ${
              summoner.losses
            }L / WR ${summoner.winRatio}%`,
          });
        }
        // Fourth place and below
        if (i > 2) {
          embed.addFields({
            name: `\u200b`,
            value: `${i + 1}. **${link}** 🏅 **${summoner.tier} ${
              summoner.rank
            } ${summoner.leaguePoints} LP** - ${summoner.wins}W ${
              summoner.losses
            }L / WR ${summoner.winRatio}%`,
          });
        }
        // add empty field to separate make embed look better
        if (i === sortedSummoners.length - 1) {
          embed.addFields({
            name: '\u200b',
            value: '\u200b',
          });
        }
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.log(error);
    }
  },
};
