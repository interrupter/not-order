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
      full: ['get', 'getRaw', 'getRawByID', 'create', 'update']
    },
  },
  App = require('not-node').Application,
  notCommon = require('not-node').Common,
  metaExtend = require('not-meta').extend,
  metaRoute = require('not-meta').Route,
  notError = require('not-error').notError;

function getIP(req) {
  return req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;
};

exports.add = exports._add = async (req, res, next) => {
  try {
    let orderData = {
      ip: getIP(req),
      sessionId:  req.session.id,
      client:     req.body.client,
      content:    req.body.order,
    };
    if (req.user) {
      orderData.user = req.user.id
    }
    if(App.getEnv('event:order:add:before')){
      await App.getEnv('event:order:add:before')(orderData, req);
    }
    let result = await (App.getModel('Order')).add(orderData);
    App.logger.log(`new order ${result.orderID}`);
    const Stat = App.getModel('Statistic');
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
    //inform
    App.on('order:add:after')(result, req);
    return res.status(200).json({
      status: 'ok',
      orderID: result.orderID
    });
  } catch (e) {
    App.logger.error(e);
    App.report(e);
    return res.status(505).json({
      message: e.message,
      status: 'error'
    });
  }
}

exports._getRawByID = (req, res)=>{
  try {
    let orderID = req.params.orderID;
    if(isNaN(parseInt(orderID))){
      throw new notError('Order ID is not a Number');
    }
    App.getModel('Order').getOneByID(orderID)
      .then((row)=>{
        return res.status(200).json({
          result: row,
          status: 'ok'
        });
      })
      .catch((e)=>{
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
};


//we have only Admin level routes so, all goes with '_' prefix standart for him
metaExtend(metaRoute, module.exports, AdminActions, MODEL_OPTIONS, '_');
metaExtend(metaRoute, module.exports, UserActions, MODEL_OPTIONS, '');
