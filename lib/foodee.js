const debug = require('debug')('foodee');
require('axios-debug-log');
const request = require('axios');
const uniqBy = require('lodash.uniqby');

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
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.101 Safari/537.36',
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
    return request(options).then(response => {
      this.token = response.data.token;
      this.user_id = response.data.user_id;
      this.email = response.data.email;
      return response.data;
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
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.101 Safari/537.36',
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

  async getOrder (uuid) {
    await this.getToken();
    const options = {
      method: 'GET',
      url: 'https://www.food.ee/api/v2/group_orders',
      params: { uuid: uuid },
      json: true,
      headers: {
        'cache-control': 'no-cache',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.101 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest',
        'content-type': 'application/vnd.api+json',
        authorization: `Token token="${this.token}""`
      }
    };
    debug('Getting order - %s', `${options.url}?uiid=${uuid}`);
    return request(options).then(results => results.data);
  }
  async getRestaurant (id) {
    const options = {
      method: 'GET',
      url: `https://www.food.ee/api/v2/restaurants/${id}`,
      json: true,
      headers: {
        'cache-control': 'no-cache',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.101 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest',
        'content-type': 'application/vnd.api+json'
      }
    };
    debug(`getRestaurant - ${options.url}`);
    return request(options).then(results => results.data.restaurant);
  }
}

module.exports = Foodee;
