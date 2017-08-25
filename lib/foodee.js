const debug = require('debug')('foodee');
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

  async getMenuItems (restaurantId) {
    await this.getToken();
    const options = {
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
    debug(
      'Getting order - %s',
      `https://www.food.ee/api/v3/restaurants/${restaurantId}/menus`
    );
    return request(Object.assign({}, options, {
      url: `https://www.food.ee/api/v3/restaurants/${restaurantId}/menus`,
      params: {
        include:
          'menu-groups.menu-items.dietary-tags,restaurant,menu-groups.menu-items.menu-option-groups.menu-option-items',
        'filter[active]': true
      }
    })).then(results =>
      results.data.included
        .filter(elm => elm.type === 'menu-items')
        .reduce((all, menuItem) => {
          all[menuItem.id] = menuItem.attributes;
          return all;
        }, {})
    );
  }
  async getOrder (uuid) {
    await this.getToken();
    const options = {
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
    debug('Getting order - %s', `${options.url}?uiid=${uuid}`);
    const orderDetails = await request(Object.assign({}, options, {
      url: 'https://www.food.ee/api/v3/orders',
      params: { 'filter[uuid]': uuid, include: 'restaurant' }
    })).then(results => {
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
    const menuItems = await this.getMenuItems(orderDetails.restaurant.id);
    const orderMembers = await request(Object.assign({}, options, {
      url: `https://www.food.ee/api/v3/orders/${orderDetails.id}/group-order-members`,
      params: {
        'page[limit]': 300,
        'page[offset]': 0,
        include:
          'order-items.menu-item,order-items.menu-option-items,order-items.order,order'
      }
    })).then(results =>
      results.data.data
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
                return Object.assign({}, orderItem.attributes, menuItems[orderItem.relationships['menu-item'].data.id]);
              })
            }
          );
        })
    );
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
