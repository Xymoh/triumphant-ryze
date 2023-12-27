const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('triumphantRyzeDB', 'postgres', 'admin', {
  host: 'localhost',
  dialect: 'postgres',
  port: 5433,
});

const connectToDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

module.exports = {
  connectToDB,
  sequelize,
};
