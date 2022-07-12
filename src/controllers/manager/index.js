import ncOrder from '../lib/ncOrder.js';
import ncOrderOptions from '../lib/ncOrderOptions.js';

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
                id: 		'orders',
                title: 	'Заказы'
            }],
            items:		[{
                priority: 10,
                section: 'orders',
                title: 	'Список',
                url: 		'/orders/order'
            },{
                priority: 1,
                section: 'orders',
                title: 	'Настройки',
                url: 		'/orders/options'
            }]
        }
    }
};

export {ncOrderOptions, ncOrder, manifest};
