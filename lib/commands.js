const Foodee = require('./foodee');
const utils = require('./utils');
const moment = require('moment');
require('moment-timezone');
const memoize = require('lodash.memoize');

const getFoodee = memoize((username, password) => { //eslint-disable-line
  if (!username || !password) {
    throw new Error('No username or password provided for foodee');
  }
  return new Foodee(username, password);
});

const stringOrder = async function stringOrder(order) {
  const info = await this.getFoodee().getOrder(order.uuid);
  const orderItems = info.order_items.reduce((data, item) => {
    // for now lets look at description, otherwise we'll have to load by group_order_member_id
    /* eslint-disable no-param-reassign */
    const [name,, foodName] = item.description.split(' - ', 3);
    if (!data[name]) { data[name] = { }; }
    if (!data[name][foodName]) { data[name][foodName] = 0; }
    data[name][foodName] += item.quantity;
    /* eslint-enable no-param-reassign */
    return data;
  }, {});
  return Object.keys(orderItems).map(name => {
    const items = Object.keys(orderItems[name]).sort().map(item => {
      if (orderItems[name][item] > 1) {
        return `${orderItems[name][item]}x ${item}`;
      }
      return item;
    }).join('\n');
    return `*${name}*\n${items}`;
  }).join('\n');
};

class Commands {
  constructor(req, res) {
    this.req = req;
    this.res = res;
    this.help = this.usage;
  }

  getFoodee() {
    return getFoodee(this.req.foodee_user.username, this.req.foodee_user.password);
  }

  async login(username, password) {
    if (!username) { return this.usage('No username provided'); }
    if (!password) { return this.usage('No password provided'); }

    const foodee = getFoodee(username, password);
    await foodee.login();

    await this.req.data.storeUser(this.req.body, {
      username: username,
      password: password
    });

    return Promise.resolve({
      response_type: 'ephemeral',
      text: 'Logged in'
    });
  }

  usage(extra) {
    const response = [];
    if (extra) {
      response.push(`*${extra}*`);
    }

    response.push('Usage: `/foodee command`');
    response.push('Where [command] is one of the following:');
    response.push('\tlogin [username] [password] - login');
    response.push('\ttoday|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday - look at that days order(s)');
    response.push('\tdate yyyy-mm-dd - Look at dates orders(s)');

    return Promise.resolve({
      response_type: 'ephemeral',
      text: response.join('\n')
    });
  }

  today() {
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }
    const date = moment().tz('America/Los_Angeles').format('YYYY-MM-DD');
    return this.date(date);
  }

  tomorrow() {
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }
    const date = moment().add(1, 'day').tz('America/Los_Angeles').format('YYYY-MM-DD');
    return this.date(date);
  }

  monday() {
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }
    return this.date(utils.getDay(1));
  }

  tuesday() {
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }
    return this.date(utils.getDay(2));
  }

  wednesday() {
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }
    return this.date(utils.getDay(3));
  }

  thursday() {
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }
    return this.date(utils.getDay(4));
  }

  friday() {
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }
    return this.date(utils.getDay(5));
  }

  saturday() {
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }
    return this.date(utils.getDay(6));
  }

  sunday() {
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }
    return this.date(utils.getDay(7));
  }

  async date(date) {
    if (!date) { return this.today(); }
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }

    let orders = await this.getFoodee().getFutureOrders();
    orders = orders.filter(order => order.deliver_at.includes(date));
    if (!orders.length) {
      orders = await this.getFoodee().getPastOrders();
      orders = orders.filter(order => order.deliver_at.includes(date));
    }
    orders = orders.filter(order => order.uuid);
    if (!orders.length) {
      return {
        response_type: 'ephemeral',
        text: `No orders for ${date}`
      };
    }
    const orderStr = await Promise.all(
      orders.map(order => stringOrder.call(this, order))
    ).then(strs => strs.join('\n'));
    return Promise.resolve({
      response_type: 'in_channel',
      text: `*${date}*\n${orderStr}`
    });
  }

}

module.exports = Commands;
