const moment = require('moment');
require('moment-timezone');

function getDay (dayOfWeek, startDate = moment()) {
  let date = startDate.tz('America/Los_Angeles');
  while (date.isoWeekday() !== dayOfWeek) {
    date = date.add(1, 'day');
  }
  return date.format('YYYY-MM-DD');
}

module.exports = {
  getDay: getDay
};
