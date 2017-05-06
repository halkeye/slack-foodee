const fs = require('fs');
const path = require('path');
const url = require('url');
const Sequelize = require('sequelize');

const settings = Object.assign(
  {},
  {
    database: 'foodee-slack',
    host: 'localhost',
    dialect: 'sqlite',
    storage: path.join(__dirname, '..', '..', (process.env.NODE_ENV || 'development') + '.db'), //eslint-disable-line
    logging: false
  },
  process.env.DB_SETTINGS_OVERRIDE ? JSON.parse(process.env.DB_SETTINGS_OVERRIDE) : {}
);

if (process.env.CLEARDB_DATABASE_URL) {
  const parsed = url.parse(process.env.CLEARDB_DATABASE_URL);
  settings.dialect = parsed.protocol.replace(':', '');
  [settings.username, settings.password] = parsed.auth.split(':');
  settings.host = parsed.hostname;
  settings.database = parsed.path.replace('/', '').split('?').shift();
}
const sequelize = new Sequelize(settings.database, settings.username, settings.password, settings);

const db = {};
const models = [];

fs
  .readdirSync(__dirname)
  .filter(file => (file.indexOf('.') !== 0) && (file !== 'index.js'))
  .forEach(file => {
    const model = sequelize.import(path.join(__dirname, file));
    db[model.name] = model;
    models.push(model);
  });

Object.keys(db).forEach(modelName => {
  if ('associate' in db[modelName]) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

db.getUser = function getUser (slackData) {
  return db.User.findOne({ where: { team_id: slackData.team_id } });
};

db.storeUser = function storeUser (slackData, userData) {
  return db.User.upsert(Object.assign({}, userData, {
    team_id: slackData.team_id,
    user_id: slackData.user_id
  }));
};

db.destroyAll = function destroyAll () {
  return Promise.all(models.map(model => model.destroy({ truncate: true })));
};

db.syncAll = function syncAll (opt) {
  return Promise.all(models.map(model => model.sync(opt)));
};

module.exports = db;
