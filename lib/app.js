const express = require('express');
const session = require('express-session');
const Grant = require('grant-express');
const bodyParser = require('body-parser');
const router = require('express-promise-router')();
const compression = require('compression');

const SLACK_TOKEN = process.env.SLACK_VERIFICATION_TOKEN;

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

module.exports = function App() {
  const app = express();
  app.use(async (req, res, next) => {
    req.commands = new Commands(req, res); // eslint-disable-line no-param-reassign
    req.data = app.data; // eslint-disable-line no-param-reassign
    try {
      req.sauce_user = await app.data.getUser(); // eslint-disable-line no-param-reassign
    } catch (e) {
      // continue regardless of error
    }
    next();
  });
  app.use(session({
    secret: process.env.EXPRESS_SECRET_TOKEN || 'secret-token',
    resave: true,
    saveUninitialized: false,
  }));
  app.use(compression());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));

  app.use(grant);

  router.get('/callback/slack', (req, res) => {
    res.send('Thanks for installing, type /foodee help in your slack for more information.');
  });


  router.post('/slack', (req, res) => {
    if (req.body.token !== SLACK_TOKEN) { return Promise.reject('Invalid token'); }

    const parts = req.body.text.split(' ');
    if (!parts || !parts[0]) {
      return req.commands.usage('No command specified')
        .then(json => res.json(json));
    }

    const command = parts.shift();
    if (!req.commands[command]) {
      return req.commands.usage('Invalid Command')
        .then(json => res.json(json));
    }

    return req.commands[command](...parts)
        .then(json => res.json(json));
  });

  app.use(router);
  app.use(express.static('public'));
  return app;
};

