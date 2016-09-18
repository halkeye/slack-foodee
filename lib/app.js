const express = require('express');
const session = require('express-session');
const Grant = require('grant-express');
const bodyParser = require('body-parser');
const compression = require('compression');
const errorhandler = require('errorhandler');
const request = require('request-promise');

const grant = new Grant({
  server: {
    protocol: 'https',
    state: true,
    transport: 'session',
    host: process.env.EXTERNAL_HOSTNAME,
  },
  slack: {
    key: process.env.SLACK_CLIENT_ID,
    secret: process.env.SLACK_CLIENT_SECRET,
    callback: '/callback/slack',
    scope: ['commands'],
  },
});


const Commands = require('./commands');

module.exports = function App(middlewheres = []) {
  const app = express();
  app.use(errorhandler());
  app.use(session({
    secret: process.env.EXPRESS_SECRET_TOKEN || 'secret-token',
    resave: true,
    saveUninitialized: false,
  }));
  app.use(compression());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));

  middlewheres.forEach(middlewhere => app.use(middlewhere));

  app.use(async (req, res, next) => {
    req.commands = new Commands(req, res); // eslint-disable-line no-param-reassign
    req.data = app.data; // eslint-disable-line no-param-reassign
    try {
      if (app.data) {
        req.foodee_user = await app.data.getUser(req.body); // eslint-disable-line no-param-reassign
      }
    } catch (e) {
      // continue regardless of error
    }
    next();
  });

  app.use(grant);

  app.get('/callback/slack', (req, res) => {
    res.send('Thanks for installing, type /foodee help in your slack for more information.');
  });

  app.post('/slack', async (req, res, next) => {
    if (req.body.token !== app.SLACK_TOKEN) {
      next('Invalid slack token');
      return;
    }
    res.status(200).send('Fetching...');

    const reply = message => request({
      method: 'POST',
      json: true,
      url: req.body.response_url,
      body: message,
    });

    Promise.resolve().then(() => {
      const parts = req.body.text.split(' ');
      if (!parts || !parts[0]) {
        return req.commands.usage('No command specified');
      }

      const command = parts.shift();
      if (!req.commands[command]) {
        return req.commands.usage('Invalid Command');
      }

      return req.commands[command](...parts);
    })
      .then(json => reply(json))
      .then(() => next())
      .catch(err => {
        delete err.options; // eslint-disable-line no-param-reassign
        delete err.request; // eslint-disable-line no-param-reassign
        delete err.response; // eslint-disable-line no-param-reassign
        console.log('error', err); // eslint-disable-line no-console
        reply('unable to get info due to error');
        next(err);
      });
  });

  app.use(express.static('public'));
  return app;
};

