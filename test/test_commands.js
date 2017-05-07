const path = require('path');
const nock = require('nock');

const Commands = require('../lib/commands.js');
const db = require('../lib/models');

const nockFixtures = {
  goodSignin: () => {
    nock('https://www.food.ee')
      .post('/api/v2/users/sign_in')
      .replyWithFile(200, path.join(__dirname, 'fixtures/nock_foodee_signin_good.json'));
  },
  badSignin: () => {
    nock('https://www.food.ee')
      .post('/api/v2/users/sign_in')
      .replyWithFile(401, path.join(__dirname, 'fixtures/nock_foodee_signin_bad.json'));
  },
  goodOrders: () => {
    nock('https://www.food.ee')
      .get('/api/v2/restaurants/55')
      .replyWithFile(200, path.join(__dirname, 'fixtures/nock_foodee_resturants_55.json'));
    nock('https://www.food.ee')
      .get('/api/v2/orders')
      .query(() => true)
      .times(2)
      .replyWithFile(200, path.join(__dirname, 'fixtures/nock_foodee_orders_good.json'), { 'Content-Type': 'application/json' });
  },
  badOrders: () => {
    nock('https://www.food.ee')
      .get('/api/v2/orders')
      .query(() => true)
      .times(2)
      .replyWithFile(200, path.join(__dirname, 'fixtures/nock_foodee_orders_bad.json'));
  },
  goodOrder: () => {
    nock('https://www.food.ee')
      .get('/api/v2/group_orders')
      .query({ uuid: 'db079f36-8365-4c65-96fd-5f4ad27a76af' })
      .times(2)
      .replyWithFile(200, path.join(__dirname, 'fixtures/nock_foodee_order_good.json'), { 'Content-Type': 'application/json' });
  }
};

describe('commands', function () {
  before(async () => {
    nock.disableNetConnect();
    await db.syncAll({ force: true });
  });
  beforeEach(() => db.destroyAll());
  afterEach(() => nock.cleanAll());
  after(() => {
    nock.enableNetConnect();
  });

  beforeEach(function () {
    this.req = {
      body: { team_id: 1, user_id: 1 },
      log: {},
      data: db
    };
    this.res = { };
    this.commands = new Commands(this.req, this.res);
  });
  describe('usage', function () {
    it('no parameters', function () {
      return this.commands.usage().then(function (results) {
        results.response_type.should.eql('ephemeral');
        results.text.should.match(/^Usage:/);
      });
    });
    it('error message', function () {
      return this.commands.usage('Error message').then(function (results) {
        results.response_type.should.eql('ephemeral');
        results.text.should.match(/^\*Error message\*\nUsage:/);
      });
    });
  });
  describe('login', function () {
    it('no parameters should output usage', function () {
      return this.commands.login().then(function (results) {
        results.response_type.should.eql('ephemeral');
        results.text.should.match(/No username provided/);
      });
    });
    it('only username should output usage', function () {
      return this.commands.login('username').then(function (results) {
        results.response_type.should.eql('ephemeral');
        results.text.should.match(/No password provided/);
      });
    });
    it('correct username and password should login', function () {
      nockFixtures.goodSignin();
      return this.commands.login('username', 'password').then(function (results) {
        results.should.not.have.keys('response_type');
        results.text.should.match(/Logged in/);
      });
    });
    it('incorrect username and password shouldnt login', function () {
      nockFixtures.badSignin();
      return this.commands.login('username', 'password').should.be.rejected();
    });
  });
  describe('date', function () {
    it('not logged in should error', async function () {
      this.req.foodee_user = null;

      const results = await this.commands.date();
      results.response_type.should.eql('ephemeral');
      results.text.should.match(/Not logged in/);
    });

    it('logged in and return so', async function () {
      nockFixtures.goodSignin();
      nockFixtures.goodSignin();
      nockFixtures.goodSignin();
      nockFixtures.badOrders();
      this.req.foodee_user = { username: 'gavin', password: 'password', token: 'something', email: 'yo@yo.com' };

      const results = await this.commands.date('2015-09-19');
      results.should.eql({
        response_type: 'ephemeral',
        text: 'No orders for 2015-09-19'
      });
    });

    it('logged in and an order for date', async function () {
      nockFixtures.goodSignin();
      nockFixtures.goodSignin();
      nockFixtures.goodSignin();
      nockFixtures.goodOrders();
      nockFixtures.goodOrder();
      this.req.foodee_user = { username: 'gavin', password: 'password', token: 'something', email: 'yo@yo.com' };

      const results = await this.commands.date('2016-09-19');
      results.should.eql({
        response_type: 'in_channel',
        attachments: [
          {
            author_name: 'Banana Leaf',
            fallback: [
              '*2016-09-19*',
              '*Person 1*',
              '2x Rendang Beef Express (gf)',
              '2x Satay Chicken (df)',
              '*Person 2*',
              'Gulai Fish Fillet (df,gf)',
              '*Person 3*',
              'Boneless Curry Chicken (df,gf)',
              '*Person 4*',
              '2x Roti Canai (v)',
              '2x Satay Chicken (df)',
              '*Person 5.*',
              'Boneless Curry Chicken (df,gf)',
              'Roti Canai (v)'
            ].join('\n'),
            fields: [
              {
                short: true,
                title: 'Person 1',
                value: '2x Rendang Beef Express (gf)\n2x Satay Chicken (df)'
              },
              {
                short: true,
                title: 'Person 2',
                value: 'Gulai Fish Fillet (df,gf)'
              },
              {
                short: true,
                title: 'Person 3',
                value: 'Boneless Curry Chicken (df,gf)'
              },
              {
                short: true,
                title: 'Person 4',
                value: '2x Roti Canai (v)\n2x Satay Chicken (df)'
              },
              {
                short: true,
                title: 'Person 5.',
                value: 'Boneless Curry Chicken (df,gf)\nRoti Canai (v)'
              }
            ],
            pretext: '2016-09-19',
            thumb_url: 'https://uploads.food.ee/uploads/images/restaurants/full_bananaleafZ_2_______.jpg',
            ts: 1474311600
          }
        ]
      });
    });
  });
});
