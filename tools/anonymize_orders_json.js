const fs = require('fs');
const path = require('path');

const inputFilename = path.join(__dirname, '../orders.json');
const outputFile = path.join(__dirname, '/../__tests__/fixtures/nock_foodee_group_members.json');

const groupOrderMembers = {};
const orders = JSON.parse(fs.readFileSync(inputFilename));
orders.data.forEach(data => {
  if (data.type === 'group-order-members') {
    const newId = Object.keys(groupOrderMembers).length + 1;
    const oldId = data.id;
    groupOrderMembers[data.id] = {
      newId: newId,
      oldId: data.id
    };
    data.id = newId;
    data.attributes.name = `User ${newId}`;
    data.attributes.email = `person${newId}@example.com`;
    data.attributes.department = '';
    data.attributes['phone-number'] = '6045555555';
    Object.entries(data.relationships).forEach(([relationshipKey, relationshipValue]) => {
      if (relationshipValue.links) {
        Object.keys(relationshipValue.links).forEach(relationshipKey => {
          relationshipValue.links[relationshipKey] =
            relationshipValue.links[relationshipKey].replace(`/${oldId}/`, `/${newId}/`);
        });
      }
    });
  }
  return data;
});
//
//
//
fs.writeFileSync(
  outputFile,
  JSON.stringify(orders, null, '\t')
);
