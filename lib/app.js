const express = require('express');
const session = require('express-session');
const Grant = require('grant-express');
const bodyParser = require('body-parser');
const compression = require('compression');
const errorhandler = require('errorhandler');
const Raven = require('raven');
require('axios-debug-log');
const request = require('axios');
const router = require('express-promise-router')();
const {execSync} = require('child_process');

Raven.config(process.env.SENTRY_DSN, {
  release: execSync('git rev-parse HEAD').toString().trim(),
  environment: process.env.NODE_ENV || 'development'
}).install();

const grant = new Grant({
  server: {
    protocol: 'https',
    state: true,
    transport: 'session',
    host: process.env.EXTERNAL_HOSTNAME
  },
  slack: {
    key: process.env.SLACK_CLIENT_ID,
    secret: process.env.SLACK_CLIENT_SECRET,
    callback: '/callback/slack',
    scope: ['commands']
  }
});

const Commands = require('./commands');

module.exports = function App (middlewheres = []) {
  const app = express();
  // The request handler must be the first middleware on the app
  app.use(Raven.requestHandler());
  app.use(session({
    secret: process.env.EXPRESS_SECRET_TOKEN || 'secret-token',
    resave: true,
    saveUninitialized: false
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

  router.get('/callback/slack', (req, res) => {
    res.send('Thanks for installing, type /foodee help in your slack for more information.');
  });

  router.post('/slack', async (req, res, next) => {
    if (req.body.token !== app.SLACK_TOKEN) {
      return Promise.reject(new Error('Invalid slack token'));
    }

    let reply;
    if (/^login/.test(req.body.text)) {
      reply = (message, isError) => {
        res.status(isError ? 500 : 200).json(message);
        return Promise.resolve();
      };
    } else {
      res.status(200).json({ response_type: 'in_channel' });

      reply = message => request({
        method: 'post',
        json: true,
        url: req.body.response_url,
        data: message
      });
    }

    return Promise.resolve().then(() => {
      const parts = req.body.text.split(' ').filter(t => t.length);
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
        console.log('err', err);
        console.log('error', err.message); // eslint-disable-line no-console
        delete err.options; // eslint-disable-line no-param-reassign
        delete err.request; // eslint-disable-line no-param-reassign
        delete err.response; // eslint-disable-line no-param-reassign
        if (err.name === 'StatusCodeError') {
          try {
            reply(`*Foodee Error*: ${JSON.parse(err.error).error}`, true);
            return;
          } catch (e) {
            reply(`*Foodee Error*: + ${err.message}`, true);
            return;
          }
        }
        reply(err.message, true);
        next(err);
      })
      .catch(err => console.log(err));
  });

  app.use(router);
  app.use(express.static('public'));
  // The error handler must be before any other error middleware
  app.use(Raven.errorHandler());

  app.use(errorhandler());
  return app;
};
