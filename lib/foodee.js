const debug = require('debug')('foodee');
const querystring = require('querystring');
require('axios-debug-log');
const request = require('axios');
const uniqBy = require('lodash.uniqby');

function BadCredentials () {
  this.name = 'BadCredentials';
  this.message = 'Bad Credentials';
  this.stack = new Error().stack;
}
BadCredentials.prototype = Object.create(Error.prototype);
BadCredentials.prototype.constructor = BadCredentials;

class Foodee {
  // memoize
  constructor (user) {
    this.username = user.username;
    this.password = user.password;
    this.user_id = user.foodee_user_id;
  }

  async getToken () {
    if (!this.token) {
      await this.login();
    }
  }

  login () {
    const options = {
      method: 'post',
      url: 'https://www.food.ee/api/v2/users/sign_in',
      headers: {
        'cache-control': 'no-cache',
        'x-requested-with': 'XMLHttpRequest',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.101 Safari/537.36',
        'accept-language': 'en-CA,en;q=0.8'
      },
      data: {
        user: {
          password: this.password,
          email: this.username
        }
      }
    };
    debug('Logging in with %s', this.username);
    return request(options)
      .then(response => {
        this.token = response.data.token;
        this.user_id = response.data.user_id;
        this.email = response.data.email;
        return response.data;
      })
      .catch(err => {
        if (err.response && err.response.status) {
          throw new BadCredentials();
        }
        throw err;
      });
  }

  async getFutureOrders () {
    return this.getOrders('future');
  }

  async getPastOrders () {
    return this.getOrders('past');
  }

  async getOrders (when) {
    await this.getToken();
    const options = {
      method: 'GET',
      url: 'https://www.food.ee/api/v2/orders',
      params: { page: '1', per_page: '25', when: when },
      json: true,
      headers: {
        'cache-control': 'no-cache',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.101 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest',
        'content-type': 'application/vnd.api+json',
        authorization: `Token token="${this.token}"`
      }
    };
    debug('Getting %s orders - %s', when, options.url);
    return request(options)
      .then(results => results.data)
      .then(result => uniqBy(result.order, 'uuid'));
  }

  async _getRequestOptions () {
    await this.getToken();
    return {
      method: 'GET',
      json: true,
      headers: {
        'cache-control': 'no-cache',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.101 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest',
        'content-type': 'application/vnd.api+json',
        authorization: `Token token="${this.token}""`
      }
    };
  }

  async _getOrderDetails (uuid) {
    const options = Object.assign({}, await this._getRequestOptions(), {
      url: 'https://www.food.ee/api/v3/orders',
      params: { 'filter[uuid]': uuid, include: 'restaurant' }
    });
    debug('Getting order - %s', `${options.url}?${querystring.stringify(options.params)}`);
    return request(options).then(results => {
      if (process.env.RECORD_ORDERS_JSON) {
        require('fs').writeFileSync('orders.json', JSON.stringify(results.data, null, '\t'));
      }
      const order = results.data.data.find(elm => elm.type === 'orders');
      return Object.assign(
        {},
        order.attributes,
        {
          id: order.id,
          'set-menu': null,
          restaurant: Object.assign({},
            results.data.included.find(i => i.type === 'restaurants').attributes,
            { id: order.relationships.restaurant.data.id }
          )
        }
      );
    });
  }

  async _getOrderGroupMembers (orderDetails) {
    const options = Object.assign({}, await this._getRequestOptions(), {
      url: `https://www.food.ee/api/v3/orders/${orderDetails.id}/group-order-members`,
      params: {
        'page[limit]': 300,
        'page[offset]': 0,
        include:
          'order-items.menu-item,order-items.menu-option-items,order-items.order,order'
      }
    });
    debug('Getting group-order-members - %s', `${options.url}?${querystring.stringify(options.params)}`);

    return request(options).then(results => {
      if (process.env.RECORD_ORDERS_JSON) {
        require('fs').writeFileSync('group-order-members.json', JSON.stringify(results.data, null, '\t'));
      }
      const menuItems = results.data.included.filter(
        elm => elm.type === 'menu-items'
      ).reduce(function (acc, cur) {
        acc[cur.id] = cur.attributes;
        return acc;
      }, {});
      return results.data.data
        .filter(elm => elm.type === 'group-order-members')
        .map(member => {
          return Object.assign(
            {},
            member.attributes,
            {
              items: member.relationships['order-items'].data.map(item => {
                const orderItem = results.data.included.find(
                  i => i.type === 'order-items' && i.id === item.id
                );
                const menuItem = menuItems[orderItem.relationships['menu-item'].data.id];
                return Object.assign(
                  {},
                  orderItem.attributes,
                  menuItem,
                );
              })
            }
          );
        });
    });
  }

  async getOrder (uuid) {
    const orderDetails = await this._getOrderDetails(uuid);
    const orderMembers = await this._getOrderGroupMembers(orderDetails);
    return Object.assign({}, orderDetails, { members: orderMembers });
  }
  async getRestaurant (id) {
    const options = {
      method: 'GET',
      url: `https://www.food.ee/api/v2/restaurants/${id}`,
      json: true,
      headers: {
        'cache-control': 'no-cache',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.101 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest',
        'content-type': 'application/vnd.api+json'
      }
    };
    debug(`getRestaurant - ${options.url}`);
    return request(options).then(results => results.data.restaurant);
  }
}

module.exports = Foodee;
Foodee.BadCredentials = BadCredentials;
