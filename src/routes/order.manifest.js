module.exports = {
	model: 'order',
	url: '/api/:modelName',
	actions:{
		add:{
      method: 'PUT',
			postFix: '',
			data: ['record', 'filter', 'sorter', 'search', 'pager'],
			rules:[
				{auth: false},
				{auth: true},
				{admin: true}
			]
		},
	}
};
