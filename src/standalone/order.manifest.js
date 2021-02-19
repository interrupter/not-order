const manifest = {
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
			rows: 3,
			enabled: true,
			required: true
		},
	},
	actions:{
		add:{
      method: 	'PUT',
			postFix: 	'',
			data: 		['record', 'filter', 'sorter', 'search', 'pager'],
			title: 		'Оформление заказа',
			description: 'Для обработки вашего заказа, пожалуйста, заполните и отправьте нам эту форму.',
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
	}
};

export default manifest;
