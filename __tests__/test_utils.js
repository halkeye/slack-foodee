const moment = require('moment');
const utils = require('../lib/utils');

describe('getDate', () => {
  describe('Start Sunday', () => {
    const startDate = moment('2016-09-18');
    test('monday == right monday', () => {
      expect(utils.getDay(1, startDate)).toEqual('2016-09-19');
    });
    test('tuesday == right tuesday', () => {
      expect(utils.getDay(2, startDate)).toEqual('2016-09-20');
    });
    test('wednesday == right wednesday', () => {
      expect(utils.getDay(3, startDate)).toEqual('2016-09-21');
    });
    test('thursday == right thursday', () => {
      expect(utils.getDay(4, startDate)).toEqual('2016-09-22');
    });
    test('friday == right friday', () => {
      expect(utils.getDay(5, startDate)).toEqual('2016-09-23');
    });
    test('saturday == right saturday', () => {
      expect(utils.getDay(6, startDate)).toEqual('2016-09-24');
    });
    test('sunday == right sunday', () => {
      expect(utils.getDay(7, startDate)).toEqual('2016-09-25');
    });
  });
});
