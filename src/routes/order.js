const
	MODEL_NAME = 'Order',
	MODEL_OPTIONS = {
		MODEL_NAME,
		MODEL_TITLE: 	'Заказы'
	},
	App = require('not-node').Application,
	modMeta = require('not-meta'),
	validator = require('validator'),
	notLocale = require('not-locale'),
	notError = require('not-error').notError,
	config = require('not-config').readerForModule('order');

	function getIP(req){
		return req.headers['x-forwarded-for'] ||
		req.connection.remoteAddress ||
		req.socket.remoteAddress ||
		req.connection.socket.remoteAddress;
	};

	exports.add = exports._add = (req, res, next)=>{
		try{
			let orderData = {
				ip: getIP(req),
				sessionId: 	req.session.id,
				client: 		req.body.client,
				content: 		req.body.order,
			};
			if(req.user){
				orderData.user = req.user.id
			}
			(App.getModel('Order')).add(orderData)
				.then((res)=>{
					App.logger.log(`new order ${res.orderID}`);
					return res.status(200).json({
						status: 'ok',
						orderID: res.orderID
					});
				})
				.catch((e)=>{
					App.report(e);
					return res.status(505).json({
						message: e.message,
						status: 'error'
					});
				});
		}catch(e){
			App.report(e);
			return res.status(505).json({
				message: e.message,
				status: 'error'
			});
		}
	}
