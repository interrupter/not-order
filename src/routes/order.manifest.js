const initFromSchema = require('not-node').Fields.fromSchema;
const modelSchema = require('../models/order').thisSchema;

const FIELDS = initFromSchema(modelSchema, [
	'_id',
	['orderID', 	{}, 'ID'],
	['user', 			{}, 'userId'],
	['content', 	{}, 'orderContent'],
	['status', 	{}, 'orderStatus'],
	['sessionId',	{},'session']
]);

module.exports = {
	model: 'order',
	url: '/api/:modelName',
	fields: FIELDS,
	actions:{
		add:{
      method: 	'PUT',
			postFix: 	'',
			data: 		['record', 'filter', 'sorter', 'search', 'pager'],
			title: 		'create_order',
			fields: [
				['tel', 'email', 'name'],
				'comment'
			],
			rules:[
				{auth: false},
				{auth: true},
				{root: true}
			]
		},
		get:{
			method: 'get',
			rules: [ { root: true }, { auth: true, role: 'manager' },  ],
			postFix: '/:record[_id]/:actionName',
			title: 'Заказ',
			description: 'Сводка данных',
			fields: [
				'_id',
				'orderID',
				'sessionId',
				'user',
				'client',
				'content',
				'status',
				'ip',
				'createdAt',
				'updatedAt',
			]
		},
		getRaw:{
			method: 'GET',
			isArray: false,
			postFix: '/:record[_id]/:actionName',
			data: [],
			rules: [ { root: true }, { auth: true, role: 'manager' },  ],
		},
		getRawByID:{
			method: 'GET',
			isArray: false,
			postFix: '/:record[orderID]/:actionName',
			data: [],
			rules: [ { root: true }, { auth: true, role: 'manager' },  ],
		},
		listAndCount:{
			method: 	'get',
			postFix: 	'/:actionName',
			data: 		['record', 'filter', 'sorter', 'search', 'pager'],
			rules: [ { root: true }, { auth: true, role: 'manager' },  ],
			fields: [
				'_id',
				'orderID',
				'sessionId',
				'user',
				'client',
				'content',
				'status',
				'ip',
				'createdAt',
				'updatedAt',
			],
		},
	}
};
