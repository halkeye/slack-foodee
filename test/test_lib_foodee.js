const path = require('path');
const nock = require('nock');
const fs = require('fs');

const Foodee = require('../lib/foodee');
const fixtures = require('./_fixtures.js');

nock.disableNetConnect();
nock.cleanAll();

// Helper function to we can create fixture files easily
function writeJSON (obj, filename) {
  const fullFileName = path.join(__dirname, 'fixtures', filename);
  if (fs.existsSync(fullFileName)) {
    return;
  }
  console.log(`creating ${fullFileName}`);
  fs.writeFileSync(fullFileName, JSON.stringify(obj, null, 2));
}

const nockFixtures = {
  goodSignin: () => {
    nock('https://www.food.ee')
      .post('/api/v2/users/sign_in')
      .replyWithFile(
        200,
        path.join(__dirname, 'fixtures/nock_foodee_signin_good.json')
      );
  },
  badSignin: () => {
    nock('https://www.food.ee')
      .post('/api/v2/users/sign_in')
      .replyWithFile(
        401,
        path.join(__dirname, 'fixtures/nock_foodee_signin_bad.json')
      );
  },
  goodOrders: () => {
    nock('https://www.food.ee')
      .get('/api/v2/restaurants/55')
      .replyWithFile(
        200,
        path.join(__dirname, 'fixtures/nock_foodee_resturants_55.json')
      );
    nock('https://www.food.ee')
      .get('/api/v2/orders')
      .query(() => true)
      .times(2)
      .replyWithFile(
        200,
        path.join(__dirname, 'fixtures/nock_foodee_orders_good.json'),
        { 'Content-Type': 'application/json' }
      );
  },
  badOrders: () => {
    nock('https://www.food.ee')
      .get('/api/v2/orders')
      .query(() => true)
      .times(2)
      .replyWithFile(
        200,
        path.join(__dirname, 'fixtures/nock_foodee_orders_bad.json')
      );
  },
  goodOrder: () => {
    nock('https://www.food.ee', { encodedQueryParams: true })
      .get('/api/v3/orders')
      .query({
        filter: { uuid: 'b7b18cc6-c95f-42e2-9b99-6c1c93440218' },
        include: 'restaurant'
      })
      .times(2)
      .replyWithFile(
        200,
        path.join(__dirname, 'fixtures/nock_foodee_order_good.json'),
        { 'Content-Type': 'application/json' }
      );
  }
};

describe('foodee', function () {
  describe(`good login()`, async function () {
    const foodee = new Foodee({});
    nockFixtures.goodSignin();
    const login = await foodee.login();
    writeJSON(login, `lib_foodee_good_login.json`);
    login.should.eql(fixtures[`lib_foodee_good_login`]);
  });

  describe(`bad login()`, async function () {
    const foodee = new Foodee({});
    nockFixtures.badSignin();
    foodee.login().should.be.rejectedWith(Foodee.BadCredentials);
  });

  ['good', 'bad'].forEach(type => {
    describe(`get${type}Orders`, function () {
      const foodee = new Foodee({
        username: 'gavin@example.com',
        password: 'password'
      });
      nockFixtures.goodSignin();
      nockFixtures[`${type}Orders`]();

      it('getFutureOrders', async () => {
        const orders = await foodee.getFutureOrders();
        writeJSON(orders, `lib_foodee_${type}_get_future_orders.json`);
        orders.should.eql(fixtures[`lib_foodee_${type}_get_future_orders`]);
      });

      it('getPastOrders', async () => {
        const orders = await foodee.getPastOrders();
        writeJSON(orders, `lib_foodee_${type}_get_past_orders.json`);
        orders.should.eql(fixtures[`lib_foodee_${type}_get_past_orders`]);
      });
    });
  });

  describe('getOrder', function () {
    nockFixtures.goodSignin();
    nockFixtures.goodOrder();
    nock('https://www.food.ee', { encodedQueryParams: true })
      .get('/api/v3/orders/105425/group-order-members')
      .query({
        page: { limit: 300, offset: 0 },
        include:
          'order-items.menu-item,order-items.menu-option-items,order-items.order,order'
      })
      .replyWithFile(
        200,
        path.join(__dirname, 'fixtures/nock_foodee_group_members.json'),
        { 'Content-Type': 'application/json' }
      );

    nock('https://www.food.ee', { encodedQueryParams: true })
      .get('/api/v3/restaurants/10/menus')
      .query({
        filter: { active: true },
        include:
          'menu-groups.menu-items.dietary-tags,restaurant,menu-groups.menu-items.menu-option-groups.menu-option-items'
      })
      .replyWithFile(
        200,
        path.join(__dirname, 'fixtures/nock_foodee_restaurants_616_menus.json'),
        { 'Content-Type': 'application/json' }
      );

    const foodee = new Foodee({
      username: 'gavin@example.com',
      password: 'password'
    });
    it('getOrder', async () => {
      const order = await foodee.getOrder(
        'b7b18cc6-c95f-42e2-9b99-6c1c93440218'
      );
      writeJSON(order, 'lib_foodee_good_order.json');
      order.should.eql(fixtures.lib_foodee_good_order);
    });
  });
});
