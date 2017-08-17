const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
module.exports = new Proxy(
  {},
  {
    get: (target, name) => {
      if (!target[name]) {
        const filename = fs
          .readdirSync(FIXTURES_DIR)
          .find(i => path.parse(i).name === name);
        if (!filename) {
          throw new Error(`No such fixture of ${name}`);
        }
        const fullPath = path.join(FIXTURES_DIR, filename);
        target[name] = require(fullPath);
      }
      return target[name];
    }
  }
);
