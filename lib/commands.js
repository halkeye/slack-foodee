const Foodee = require('./foodee');
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
      password: password,
    });

    return Promise.resolve({
      response_type: 'ephemeral',
      text: 'Logged in',
    });
  }

  usage(extra) {
    const response = [];
    if (extra) {
      response.push(`*${extra}*`);
    }

    response.push('Usage: `/foodee command [options]`');
    response.push('Where [command] is one of the following:');
    response.push('\tlogin [username] [password] - login');
    response.push('\ttoday - look at todays order(s)');
    response.push('\tdate yyyy-mm-dd - Look at dates orders(s)');

    return Promise.resolve({
      response_type: 'ephemeral',
      text: response.join('\n'),
    });
  }

  today() {
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }
    const date = moment().tz('America/Los_Angeles').format('YYYY-MM-DD');
    return this.date(date);
  }

  async date(date) {
    if (!date) { return this.today(); }
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }

    const allOrders = await this.getFoodee().getOrders();
    if (!allOrders.order.length) {
      return {
        response_type: 'ephemeral',
        text: `No orders for ${date}`,
      };
    }
    const orders = allOrders.order.filter(order => order.deliver_at.includes(date));
    const orderStr = await Promise.all(
      orders.map(order => stringOrder.call(this, order))
    );
    return Promise.resolve({
      response_type: 'in_channel',
      text: `*${date}*\n${orderStr}`,
    });
  }

}

module.exports = Commands;
