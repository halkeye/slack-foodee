class Commands {
  constructor(req, res) {
    this.req = req;
    this.res = res;
    this.help = this.usage;
  }

  async login(username, password) {
    if (!username) { return this.usage('No username provided'); }
    if (!password) { return this.usage('No password provided'); }

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
    response.push('\tme - What did I order today?');

    return Promise.resolve({
      response_type: 'ephemeral',
      text: response.join('\n'),
    });
  }

  today() {
    if (!this.req.sauce_user) { return this.usage('Not logged in'); }
    return Promise.resolve({
      response_type: 'in_channel',
      text: '**Date**\n\n*Gavin*\n order 1\n Order 2',
    });
  }

  date(date) {
    if (!date) { return this.today(); }
    if (!this.req.sauce_user) { return this.usage('Not logged in'); }
    return Promise.resolve({
      response_type: 'in_channel',
      text: '*Gavin*\n order 1\n Order 2',
    });
  }

}

module.exports = Commands;
