module.exports = {
	model: 'order',
	url: '/api/:modelName',
	fields: {
		tel: {
			component: 'UITelephone',
			label: 'Ваш номер телефона',
			placeholder: '',
			enabled: true,
			value: '',
			required: true
		},
		email: {
			component: 'UIEmail',
			label: 'Email',
			placeholder: 'Ваш email адрес',
			enabled: true,
			required: true,
			value: '',
		},
		name: {
			component: 'UITextfield',
			label: 'Имя',
			placeholder: 'Как нам к вам обращаться?',
			value: '',
			enabled: true,
			required: true
		},
		comment: {
			component: 'UITextarea',
			label: 'Дополнительно',
			placeholder: 'Дополнительные сведения',
			value: '',
			enabled: true,
			required: true
		},
	},
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
	}
};
