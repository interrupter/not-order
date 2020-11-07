const initFromSchema = require('not-node').Fields.fromSchema;
const modelSchema = require('../models/order').thisSchema;

const FIELDS = initFromSchema(modelSchema, [
	'_id',
	['orderID', {}, 'ID']
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
				{admin: true}
			]
		},
		get:{
			method: 'get',
			rules:[{
				auth: true,
				admin: true
			}],
			postFix: '/:record[_id]/:actionName',
			title: 'form_title_view',
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
			auth: true,
			admin: true
		},
		getRawByID:{
			method: 'GET',
			isArray: false,
			postFix: '/:record[orderID]/:actionName',
			data: [],
			auth: true,
			admin: true
		},
		listAndCount:{
			method: 	'get',
			postFix: 	'/:actionName',
			data: 		['record', 'filter', 'sorter', 'search', 'pager'],
			rules:[ { admin: true } ],
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
