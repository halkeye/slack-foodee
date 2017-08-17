const fixtures = require('./_fixtures.js');

const Foodee = require('../lib/foodee.js');
const Commands = require('../lib/commands.js');
const db = require('../lib/models');

describe('commands', function () {
  before(async () => db.syncAll({ force: true }));
  beforeEach(() => db.destroyAll());

  beforeEach(function () {
    this.req = {
      body: { team_id: 1, user_id: 1 },
      log: {},
      data: db
    };
    this.res = {};
    this.commands = new Commands(this.req, this.res);
    this.foodee_mocks = {
      getFutureOrders: () =>
        Promise.resolve(fixtures.lib_foodee_good_get_future_orders),
      getPastOrders: () =>
        Promise.resolve(fixtures.lib_foodee_good_get_past_orders),
      getOrder: () => Promise.resolve(fixtures.lib_foodee_good_order)
    };

    this.commands.getFoodee = () => this.foodee_mocks;
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
      this.foodee_mocks.login = () =>
        Promise.resolve(fixtures.lib_foodee_good_login);
      return this.commands
        .login('username', 'password')
        .then(function (results) {
          results.should.not.have.keys('response_type');
          results.text.should.match(/Logged in/);
        });
    });
    it('incorrect username and password shouldnt login', function () {
      this.foodee_mocks.login = () =>
        Promise.reject(new Foodee.BadCredentials());
      return this.commands
        .login('username', 'password')
        .then(function (results) {
          results.should.not.have.keys('response_type');
          results.text.should.match(/Bad Username or password/);
        });
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
      this.foodee_mocks.getPastOrders = this.foodee_mocks.getFutureOrders = () =>
        Promise.resolve(fixtures.lib_foodee_bad_get_future_orders);
      this.req.foodee_user = {
        username: 'gavin',
        password: 'password',
        token: 'something',
        email: 'yo@yo.com'
      };

      const results = await this.commands.date('2015-09-19');
      results.should.eql({
        response_type: 'ephemeral',
        text: 'No orders for 2015-09-19'
      });
    });

    it('logged in and an order for date', async function () {
      this.req.foodee_user = {
        username: 'gavin',
        password: 'password',
        token: 'something',
        email: 'yo@yo.com'
      };

      const results = await this.commands.date('2016-09-19');
      results.should.eql({
        response_type: 'in_channel',
        attachments: [
          {
            author_name: "Finch's Teahouse",
            fields: [
              {
                title: 'Bearded Man',
                value: 'Mandu\nSpicy Pork Burrito',
                short: true
              },
              { title: 'Darth Maul', value: 'Bulgogi Burrito', short: true },
              {
                title: 'Person 1',
                value: 'Chicken Mayo Bibimbap\nMandu',
                short: true
              },
              {
                title: 'Person 2',
                value: 'BBQ Short Rib Burrito \nChicken Mayo Bibimbap',
                short: true
              },
              {
                title: 'Person 3',
                value: 'Corn Chips \nSalsa\nVegetarian Bibimbap',
                short: true
              },
              {
                title: 'Person 4',
                value: 'Chicken Mayo Bibimbap\nCorn Chips ',
                short: true
              },
              {
                title: 'Person 5',
                value: 'Mandu\nSpicy Pork Burrito',
                short: true
              },
              {
                title: 'Person 6',
                value: 'Bulgogi Burrito\nMandu',
                short: true
              },
              { title: 'Person 7', value: 'Spicy Pork Burrito', short: true }
            ],
            pretext: '2016-09-19',
            thumb_url:
              'https://uploads.food.ee/uploads/images/restaurants/full_Finches02.jpg',
            ts: 1502909100
          }
        ]
      });
    });
  });
});
