import ncOrder from './ncOrder.js';
import ncOrderOptions from './ncOrderOptions.js';

let manifest = {
	router: {
		manifest: [
			{
				paths: ['orders/order\/([^\/]+)\/([^\/]+)', 'orders/order\/([^\/]+)', 'orders/order'],
				controller: ncOrder
			},
			{
				paths: ['orders/options'],
				controller: ncOrderOptions
			}
		]
	},
	menu: {
		side:{
			sections: [{
				id: 		'order',
				title: 	'Заказы'
			}],
			items:		[{
				priority: 10,
        section: 'order',
				title: 	'Список',
				url: 		'/orders/order'
			},{
				priority: 1,
        section: 'order',
        title: 	'Настройки',
        url: 		'/orders/options'
      }]
		}
	}
};

export {ncOrderOptions, ncOrder, manifest};
