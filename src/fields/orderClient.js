const Schema = require('mongoose').Schema;

module.exports = {
  ui:{
    component:  'UIOrderClient',
    readonly: true
  },
  model: {
    type: [Schema.Types.Mixed],
    searchable: true,
    required: true,
  }
};
