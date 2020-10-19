const
  UserActions = [],
  AdminActions = [
    'get',
    'getRaw',
    'list',
    'listAndCount',
    'listAll'
  ],
  MODEL_NAME = 'Order',
  MODEL_OPTIONS = {
    MODEL_NAME,
    MODEL_TITLE: 'Заказы',
    populate: {
      get: ['userId']
    },
    RESPONSE: {
      full: ['get', 'getRaw', 'create', 'update']
    },
  },
  App = require('not-node').Application,
  notCommon = require('not-node').notCommon,
  metaExtend = require('not-meta').extend,
  metaRoute = require('not-meta').Route,
  validator = require('validator'),
  notLocale = require('not-locale'),
  notError = require('not-error').notError,
  config = require('not-config').readerForModule('order');

function getIP(req) {
  return req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;
};

exports.add = exports._add = (req, res, next) => {
  try {
    let orderData = {
      ip: getIP(req),
      sessionId: req.session.id,
      client: req.body.client,
      content: req.body.order,
    };
    const Stat = App.getModel('Statistic');
    if (req.user) {
      orderData.user = req.user.id
    }
    (App.getModel('Order')).add(orderData)
      .then(async (result) => {
        App.logger.log(`new order ${result.orderID}`);
        if (Stat){
          await Stat.add(result._id,
            {
              id:			  result.orderID,
              action: 	'add',
              model: 		notCommon.firstLetterToLower(MODEL_NAME),
              user: 		orderData.user,
              session: 	orderData.sessionId,
              ip:			  orderData.ip
            });
        }
        return res.status(200).json({
          status: 'ok',
          orderID: result.orderID
        });
      })
      .catch((e) => {
        App.report(e);
        return res.status(505).json({
          message: e.message,
          status: 'error'
        });
      });
  } catch (e) {
    App.report(e);
    return res.status(505).json({
      message: e.message,
      status: 'error'
    });
  }
}


//we have only Admin level routes so, all goes with '_' prefix standart for him
metaExtend(metaRoute, module.exports, AdminActions, MODEL_OPTIONS, '_');
metaExtend(metaRoute, module.exports, UserActions, MODEL_OPTIONS, '');
