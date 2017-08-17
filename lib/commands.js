const Foodee = require('./foodee');
const utils = require('./utils');
const moment = require('moment');
const uniqBy = require('lodash.uniqby');
require('moment-timezone');

function findOrders (orders, date) {
  return orders
    .filter(order => order.uuid)
    .filter(order => order.state !== 'cancelled')
    .filter(order => order.deliver_at.includes(date));
}

class Commands {
  constructor (req, res) {
    this.req = req;
    this.res = res;
    this.help = this.usage;
  }

  getFoodee (override) {
    return new Foodee(override || this.req.foodee_user);
  }

  async login (username, password) {
    if (!username) {
      return this.usage('No username provided');
    }
    if (!password) {
      return this.usage('No password provided');
    }

    const foodee = this.getFoodee({ username: username, password: password });
    try {
      await foodee.login();

      await this.req.data.storeUser(this.req.body, {
        username: username,
        password: password,
        token: foodee.token,
        email: foodee.email,
        foodee_user_id: foodee.user_id
      });

      return { text: 'Logged in' };
    } catch (e) {
      if (e instanceof Foodee.BadCredentials) {
        return { text: 'Bad Username or password' };
      }
      throw e;
    }
  }

  usage (extra) {
    const response = [];
    if (extra) {
      response.push(`*${extra}*`);
    }

    response.push('Usage: `/foodee command`');
    response.push('Where [command] is one of the following:');
    response.push('\tlogin [username] [password] - login');
    response.push(
      '\ttoday|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday - look at that days order(s)'
    );
    response.push('\tdate yyyy-mm-dd - Look at dates orders(s)');

    return Promise.resolve({
      response_type: 'ephemeral',
      text: response.join('\n')
    });
  }

  today () {
    if (!this.req.foodee_user) {
      return this.usage('Not logged in');
    }
    const date = moment().tz('America/Los_Angeles').format('YYYY-MM-DD');
    return this.date(date);
  }

  tomorrow () {
    if (!this.req.foodee_user) {
      return this.usage('Not logged in');
    }
    const date = moment()
      .add(1, 'day')
      .tz('America/Los_Angeles')
      .format('YYYY-MM-DD');
    return this.date(date);
  }

  monday () {
    if (!this.req.foodee_user) {
      return this.usage('Not logged in');
    }
    return this.date(utils.getDay(1));
  }

  tuesday () {
    if (!this.req.foodee_user) {
      return this.usage('Not logged in');
    }
    return this.date(utils.getDay(2));
  }

  wednesday () {
    if (!this.req.foodee_user) {
      return this.usage('Not logged in');
    }
    return this.date(utils.getDay(3));
  }

  thursday () {
    if (!this.req.foodee_user) {
      return this.usage('Not logged in');
    }
    return this.date(utils.getDay(4));
  }

  friday () {
    if (!this.req.foodee_user) {
      return this.usage('Not logged in');
    }
    return this.date(utils.getDay(5));
  }

  saturday () {
    if (!this.req.foodee_user) {
      return this.usage('Not logged in');
    }
    return this.date(utils.getDay(6));
  }

  sunday () {
    if (!this.req.foodee_user) {
      return this.usage('Not logged in');
    }
    return this.date(utils.getDay(7));
  }

  async date (date) {
    if (!date) {
      return this.today();
    }
    if (!this.req.foodee_user) {
      return this.usage('Not logged in');
    }

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

    orders = await Promise.all(
      orders.map(order => this.getFoodee().getOrder(order.uuid))
    );
    return {
      response_type: 'in_channel',
      attachments: orders.map(order => {
        return {
          pretext: date,
          author_name: order.restaurant.name,
          fields: order.members
            .filter(member => member.items.length)
            .map(member => {
              const str = member.items
                .map(item => {
                  if (item.quantity > 1) {
                    return `${item.quantity}x ${item.name}`;
                  }
                  return item.name;
                })
                .sort()
                .join('\n');
              return {
                title: member.name,
                value: str,
                short: true
              };
            })
            .sort((a, b) => a.title.localeCompare(b.title)),
          thumb_url: order.restaurant['thumbnail-image-url'],
          ts: new Date(order['deliver-at']).getTime() / 1000
        };
      })
    };
  }
}

module.exports = Commands;
