const fs = require('node:fs');
const path = require('node:path');
const { Sequelize, DataTypes } = require('sequelize');

const config = require('../config.js');
const { sameRiotId } = require('./riotId.js');

const SSL_OPTIONS = {
  true: { require: true, rejectUnauthorized: true },
  'no-verify': { require: true, rejectUnauthorized: false },
};

const createSequelize = () => {
  if (config.databaseUrl) {
    const ssl = SSL_OPTIONS[config.databaseSsl];
    return new Sequelize(config.databaseUrl, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: ssl ? { ssl } : {},
    });
  }

  if (config.sqlitePath !== ':memory:') {
    fs.mkdirSync(path.dirname(config.sqlitePath), { recursive: true });
  }
  return new Sequelize({ dialect: 'sqlite', storage: config.sqlitePath, logging: false });
};

const sequelize = createSequelize();

// Table and column names match the original schema so existing databases keep working.
const GuildConfig = sequelize.define(
  'GuildConfig',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    guildId: { type: DataTypes.STRING, allowNull: false, field: 'guild_id' },
    region: { type: DataTypes.STRING, allowNull: false },
  },
  {
    tableName: 'server_configs',
    timestamps: false,
    indexes: [{ name: 'server_configs_guild_id_unique', unique: true, fields: ['guild_id'] }],
  }
);

const Player = sequelize.define(
  'Player',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    guildId: { type: DataTypes.STRING, allowNull: false, field: 'guild_id' },
    puuid: { type: DataTypes.STRING },
    // Riot removed encrypted summoner IDs from the API; kept only so old rows stay readable.
    legacySummonerId: { type: DataTypes.STRING, field: 'summoner_id' },
    platform: { type: DataTypes.STRING, allowNull: false, field: 'riot_server' },
    gameName: { type: DataTypes.STRING, field: 'summoner_name' },
    tagLine: { type: DataTypes.STRING, field: 'tag_line' },
    discordUserId: { type: DataTypes.STRING, field: 'discord_user_id' },
    addedBy: { type: DataTypes.STRING, field: 'added_by' },
    addedAt: { type: DataTypes.DATE, field: 'added_at' },
    riotIdCheckedAt: { type: DataTypes.DATE, field: 'riot_id_checked_at' },
  },
  {
    tableName: 'summoners',
    timestamps: false,
    indexes: [
      { name: 'summoners_guild_puuid_unique', unique: true, fields: ['guild_id', 'puuid'] },
    ],
  }
);

/**
 * Brings databases created by older versions of the bot up to date: adds new (nullable) columns and
 * removes duplicate rows that would otherwise block the unique indexes created by sync().
 */
const upgradeLegacySchema = async () => {
  const queryInterface = sequelize.getQueryInterface();

  for (const model of [GuildConfig, Player]) {
    const table = model.getTableName();
    if (!(await queryInterface.tableExists(table))) continue;

    const columns = await queryInterface.describeTable(table);
    for (const attribute of Object.values(model.getAttributes())) {
      if (!columns[attribute.field]) {
        await queryInterface.addColumn(table, attribute.field, {
          type: attribute.type,
          allowNull: true,
        });
        console.log(`[db] Added column ${table}.${attribute.field}`);
      }
    }
  }

  if (await queryInterface.tableExists('summoners')) {
    // Riot merged the Philippines and Thailand servers into SG2 in January 2025.
    await sequelize.query(
      `UPDATE summoners SET riot_server = 'SG2' WHERE riot_server IN ('PH2', 'TH2')`
    );
    await sequelize.query(
      `DELETE FROM summoners WHERE puuid IS NOT NULL AND id NOT IN
        (SELECT MIN(id) FROM summoners WHERE puuid IS NOT NULL GROUP BY guild_id, puuid)`
    );
  }
  if (await queryInterface.tableExists('server_configs')) {
    await sequelize.query(
      `UPDATE server_configs SET region = 'SG2' WHERE region IN ('PH2', 'TH2')`
    );
    await sequelize.query(
      `DELETE FROM server_configs WHERE id NOT IN
        (SELECT MIN(id) FROM server_configs GROUP BY guild_id)`
    );
  }
};

const initDatabase = async () => {
  await sequelize.authenticate();
  await upgradeLegacySchema();
  await sequelize.sync();
};

const closeDatabase = () => sequelize.close();

// ---- Server settings -------------------------------------------------------------------------

/** Resolves to [settings, created]. */
const ensureGuildConfig = (guildId, fallbackRegion) =>
  GuildConfig.findOrCreate({ where: { guildId }, defaults: { region: fallbackRegion } });

/** Returns the server's settings, creating them if the bot joined while it was offline. */
const getGuildConfig = async (guildId, fallbackRegion) => {
  const [guildConfig] = await ensureGuildConfig(guildId, fallbackRegion);
  return guildConfig;
};

const setGuildRegion = async (guildId, region) => {
  const [guildConfig, created] = await GuildConfig.findOrCreate({
    where: { guildId },
    defaults: { region },
  });
  if (!created && guildConfig.region !== region) await guildConfig.update({ region });
  return guildConfig;
};

/** Every server ID that has settings or players stored. */
const listStoredGuildIds = async () => {
  const [configs, players] = await Promise.all([
    GuildConfig.findAll({ attributes: ['guildId'] }),
    Player.findAll({ attributes: ['guildId'], group: ['guild_id'] }),
  ]);
  return [...new Set([...configs, ...players].map((row) => row.guildId))];
};

const deleteGuildData = (guildId) =>
  sequelize.transaction(async (transaction) => {
    const players = await Player.destroy({ where: { guildId }, transaction });
    await GuildConfig.destroy({ where: { guildId }, transaction });
    return players;
  });

// ---- Tracked players -------------------------------------------------------------------------

const listPlayers = (guildId) => Player.findAll({ where: { guildId }, order: [['id', 'ASC']] });

const countPlayers = (guildId) => Player.count({ where: { guildId } });

const findPlayerById = (guildId, id) => Player.findOne({ where: { guildId, id } });

const findPlayerByPuuid = (guildId, puuid) => Player.findOne({ where: { guildId, puuid } });

/** Case-insensitive lookup by Riot ID (handles non-latin names the same way everywhere). */
const findPlayerByRiotId = async (guildId, riotId) => {
  const players = await listPlayers(guildId);
  return players.find((player) => sameRiotId(player, riotId)) ?? null;
};

const addPlayer = (fields) => Player.create({ addedAt: new Date(), ...fields });

const clearPlayers = (guildId) => Player.destroy({ where: { guildId } });

module.exports = {
  sequelize,
  GuildConfig,
  Player,
  initDatabase,
  closeDatabase,
  ensureGuildConfig,
  getGuildConfig,
  setGuildRegion,
  deleteGuildData,
  listStoredGuildIds,
  listPlayers,
  countPlayers,
  findPlayerById,
  findPlayerByPuuid,
  findPlayerByRiotId,
  addPlayer,
  clearPlayers,
};
