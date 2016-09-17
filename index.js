const app = require('./lib/app')();
app.data = require('./lib/models');

app.data.syncAll()
  .then(() => {
    app.listen(3000, () => {
      console.log('Example app listening on port 3000!'); //eslint-disable-line
    });
  })
  .catch((err) => {
    console.error('Error syncing/starting app server:', err); //eslint-disable-line
  });
