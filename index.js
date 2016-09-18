const morgan = require('morgan');

const app = require('./lib/app')([morgan('combined')]);
app.data = require('./lib/models');

app.SLACK_TOKEN = process.env.SLACK_VERIFICATION_TOKEN;

app.data.syncAll()
  .then(() => {
    app.listen(3000, () => {
      console.log('Example app listening on port 3000!'); //eslint-disable-line
    });
  })
  .catch(err => {
    console.error('Error syncing/starting app server:', err); //eslint-disable-line
  });
