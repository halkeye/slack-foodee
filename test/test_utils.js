const moment = require('moment');
const utils = require('../lib/utils');

describe('getDate', function () {
  describe('Start Sunday', function () {
    const startDate = moment('2016-09-18');
    it('monday == right monday', function () {
      utils.getDay(1, startDate).should.eql('2016-09-19');
    });
    it('tuesday == right tuesday', function () {
      utils.getDay(2, startDate).should.eql('2016-09-20');
    });
    it('wednesday == right wednesday', function () {
      utils.getDay(3, startDate).should.eql('2016-09-21');
    });
    it('thursday == right thursday', function () {
      utils.getDay(4, startDate).should.eql('2016-09-22');
    });
    it('friday == right friday', function () {
      utils.getDay(5, startDate).should.eql('2016-09-23');
    });
    it('saturday == right saturday', function () {
      utils.getDay(6, startDate).should.eql('2016-09-24');
    });
    it('sunday == right sunday', function () {
      utils.getDay(7, startDate).should.eql('2016-09-25');
    });
  });
});
