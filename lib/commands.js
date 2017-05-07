const Foodee = require('./foodee');
const utils = require('./utils');
const moment = require('moment');
const uniqBy = require('lodash.uniqby');
require('moment-timezone');

function quantityIze (orderInfo) {
  return (orderInfo.order_items || []).reduce((data, item) => {
    // for now lets look at description, otherwise we'll have to load by group_order_member_id
    /* eslint-disable no-param-reassign */
    const [name,, foodName] = item.description.split(' - ', 3);
    if (!data[name]) { data[name] = { }; }
    if (!data[name][foodName]) { data[name][foodName] = 0; }
    data[name][foodName] += item.quantity;
    /* eslint-enable no-param-reassign */
    return data;
  }, {});
}

function stringOrder (orderItems) {
  return Object.keys(orderItems).map(name => {
    const items = Object.keys(orderItems[name]).sort().map(item => {
      if (orderItems[name][item] > 1) {
        return `${orderItems[name][item]}x ${item}`;
      }
      return item;
    }).join('\n');
    return `*${name}*\n${items}`;
  }).join('\n');
}

function findOrders (orders, date) {
  return orders.filter(order => order.uuid)
    .filter(order => order.state !== 'cancelled')
    .filter(order => order.deliver_at.includes(date));
}

class Commands {
  constructor (req, res) {
    this.req = req;
    this.res = res;
    this.help = this.usage;
  }

  getFoodee () {
    return new Foodee(this.req.foodee_user);
  }

  async login (username, password) {
    if (!username) { return this.usage('No username provided'); }
    if (!password) { return this.usage('No password provided'); }

    const foodee = new Foodee({ username: username, password: password });
    await foodee.login();

    await this.req.data.storeUser(this.req.body, {
      username: username,
      password: password,
      token: foodee.token,
      email: foodee.email,
      foodee_user_id: foodee.user_id
    });

    return Promise.resolve({ text: 'Logged in' });
  }

  usage (extra) {
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

  today () {
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }
    const date = moment().tz('America/Los_Angeles').format('YYYY-MM-DD');
    return this.date(date);
  }

  tomorrow () {
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }
    const date = moment().add(1, 'day').tz('America/Los_Angeles').format('YYYY-MM-DD');
    return this.date(date);
  }

  monday () {
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }
    return this.date(utils.getDay(1));
  }

  tuesday () {
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }
    return this.date(utils.getDay(2));
  }

  wednesday () {
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }
    return this.date(utils.getDay(3));
  }

  thursday () {
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }
    return this.date(utils.getDay(4));
  }

  friday () {
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }
    return this.date(utils.getDay(5));
  }

  saturday () {
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }
    return this.date(utils.getDay(6));
  }

  sunday () {
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }
    return this.date(utils.getDay(7));
  }

  async date (date) {
    if (!date) { return this.today(); }
    if (!this.req.foodee_user) { return this.usage('Not logged in'); }

    let orders = await Promise.all([
      this.getFoodee().getFutureOrders().then(o => findOrders(o, date)),
      this.getFoodee().getPastOrders().then(o => findOrders(o, date))
    ]).then(([future, past]) => past.concat(future));

    orders = uniqBy(orders, 'uuid');

    if (!orders.length) {
      return Promise.resolve({
        response_type: 'ephemeral',
        text: `No orders for ${date}`
      });
    }
    orders = await Promise.all(orders.map(order => {
      return Promise.all([
        this.getFoodee().getOrder(order.uuid),
        this.getFoodee().getRestaurant(order.restaurant_id)
      ]).then(([orderInfo, resturant]) => {
        return Object.assign(order, orderInfo, { resturant: resturant });
      });
    }));
    const orderStr = await Promise.all(orders.map(order => stringOrder(quantityIze(order))))
      .then(strs => strs.join('\n'))
      .catch(err => { console.error(err); throw err; });

    return {
      response_type: 'in_channel',
      attachments: orders.map(order => {
        const orderItems = quantityIze(order);
        return {
          fallback: `*${date}*\n${orderStr}`,
          pretext: date,
          author_name: order.resturant.name,
          fields: Object.keys(orderItems).map(name => {
            const str = Object.keys(orderItems[name]).map(item => {
              if (orderItems[name][item] > 1) {
                return `${orderItems[name][item]}x ${item}`;
              }
              return item;
            }).sort().join('\n');
            return {
              title: name,
              value: str,
              short: true
            };
          }).sort((a, b) => a.title.localeCompare(b.title)),
          thumb_url: order.resturant.thumbnail_image_url,
          ts: new Date(order.deliver_at).getTime() / 1000
        };
      })
    };
  }
}

module.exports = Commands;
