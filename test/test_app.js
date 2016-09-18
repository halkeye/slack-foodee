const request = require('supertest-as-promised');
const db = require('../lib/models');
const nock = require('nock');
const app = require('../lib/app')([
  function debugMiddle(req, res, next) {
    req.data = db; // eslint-disable-line no-param-reassign
    next();
  },
]);

app.SLACK_TOKEN = 'faketoken';

const defaultPost = {
  token: 'faketoken',
  team_id: 'T024TC0TE',
  team_domain: 'saucelabs',
  channel_id: 'C02FW9RJ2',
  channel_name: 'sandbox',
  user_id: 'U0CA341PF',
  user_name: 'gavin',
  command: '/sauce',
  text: '',
  response_url: 'https://hooks.slack.com/commands/T024TC0TE/37372872721/LQWTwBQEh7ocPIlkQmML17Be',
};

describe('/', () => {
  it('should return HTML', () => request(app).get('/').expect('Content-Type', /text\/html/).expect(200));
});

describe('/slack', () => {
  before(async () => {
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
    await db.syncAll({ force: true });
  });
  beforeEach(() => db.destroyAll());
  afterEach(() => nock.cleanAll());
  after(() => {
    nock.enableNetConnect();
  });

  describe('-empty-', () => {
    before(function () {
      nock('https://hooks.slack.com')
        .post('/commands/T024TC0TE/37372872721/LQWTwBQEh7ocPIlkQmML17Be', json => {
          this.json = json;
          return true;
        }).reply(200);
      return request(app)
        .post('/slack')
        .send(Object.assign({}, defaultPost))
        .set('content-type', 'application/json')
        .expect(200);
    });

    it('should post usage with error', function () {
      this.json.response_type.should.eql('ephemeral');
      this.json.text.should.containEql('No command specified');
      this.json.text.should.containEql('Usage');
    });
  });

  describe('-badcommand-', () => {
    before(function () {
      nock('https://hooks.slack.com')
        .post('/commands/T024TC0TE/37372872721/LQWTwBQEh7ocPIlkQmML17Be', json => {
          this.json = json;
          return true;
        }).reply(200);
      return request(app)
        .post('/slack')
        .send(Object.assign({}, defaultPost, { text: 'asd901i3ewq09dsaic90i' }))
        .set('content-type', 'application/json')
        .expect(200);
    });
    it('should post usage with error', function () {
      this.json.response_type.should.eql('ephemeral');
      this.json.text.should.containEql('Invalid Command');
      this.json.text.should.containEql('Usage');
    });
  });

  describe('usage', () => {
    it('show basic usage command', function () {
      this.json.response_type.should.eql('ephemeral');
      this.json.text.should.containEql('Usage');
    });
    before(function () {
      nock('https://hooks.slack.com')
        .post('/commands/T024TC0TE/37372872721/LQWTwBQEh7ocPIlkQmML17Be', json => {
          this.json = json;
          return true;
        }).reply(200);
      return request(app)
        .post('/slack')
        .send(Object.assign({}, defaultPost, { text: 'usage' }))
        .set('content-type', 'application/json')
        .expect(200);
    });
  });
});
