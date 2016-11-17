const debug = require('debug')('foodee');
const request = require('request-promise');
const uniqBy = require('lodash.uniqby');

class Foodee {

  // memoize
  constructor(username, password) {
    this.username = username;
    this.password = password;
  }

  async getToken() {
    if (!this.token || !this.user_id || !this.email) {
      await this.login();
    }
  }

  login() {
    const options = {
      method: 'POST',
      url: 'https://www.food.ee/api/v2/users/sign_in',
      headers: {
        'cache-control': 'no-cache',
        'x-requested-with': 'XMLHttpRequest',
        accept: 'application/json, text/javascript',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.101 Safari/537.36',
        'accept-language': 'en-CA,en;q=0.8',
      },
      form: {
        user: {
          password: this.password,
          email: this.username,
        },
      },
    };
    debug('Logging in with %s', this.username);
    return request(options).then(response => JSON.parse(response)).then(response => {
      this.token = response.token;
      this.user_id = response.user_id;
      this.email = response.email;
      return response;
    });
  }

  async getFutureOrders() {
    return this.getOrders('future');
  }

  async getPastOrders() {
    return this.getOrders('past');
  }

  async getOrders(when) {
    await this.getToken();
    const options = {
      method: 'GET',
      url: 'https://www.food.ee/api/v2/orders',
      qs: { page: '1', per_page: '25', when: when },
      json: true,
      headers: {
        'cache-control': 'no-cache',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.101 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest',
        accept: 'application/json, text/javascript, */*; q=0.01',
        'content-type': 'application/vnd.api+json',
        authorization: `Token token="${this.token}", email="${this.email}"`,
      },
    };
    debug('Getting %s orders - %s', when, options.url);
    return request(options)
      .then(result => uniqBy(result.order, 'uuid'));
  }

  async getOrder(uuid) {
    await this.getToken();
    const options = {
      method: 'GET',
      url: 'https://www.food.ee/api/v2/group_orders',
      qs: { uuid: uuid },
      json: true,
      headers: {
        'cache-control': 'no-cache',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.101 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest',
        accept: 'application/json, text/javascript, */*; q=0.01',
        'content-type': 'application/vnd.api+json',
        authorization: `Token token="${this.token}", email="${this.email}"`,
      },
    };
    debug('Getting order - %s', `${options.url}?uiid=${uuid}`);
    return request(options);
  }
}

module.exports = Foodee;

