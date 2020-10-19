const log = require('not-log')(module, 'Order Model');
try {
  const MODEL_NAME = 'Order';
  const initFields = require('not-node').Fields.initFields;

  const FIELDS = [
    ['sessionId', {}, 'session'],
    ['user', {}, 'userId'],
    'client',
    ['content', {}, 'orderContent'],
    ['status', {}, 'orderStatus'],
    'ip',
    'createdAt',
    'updatedAt'
  ];


  exports.keepNotExtended = false;
  exports.thisModelName = MODEL_NAME;
  exports.thisSchema = initFields(FIELDS, 'model');

  exports.enrich = {
    versioning: true,
    increment: true,
    validators: true
  };

  exports.thisStatics = {

  };

  exports.thisMethods = {

  };
} catch (e) {
  log.error(e);
}
