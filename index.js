const path = require('path');

module.exports = {
	name: 'not-order',
	paths: {
		routes:				path.join(__dirname, 'src', 'routes'),
		fields:				path.join(__dirname, 'src', 'fields'),
		controllers:	path.join(__dirname, 'src', 'controllers'),
		models:				path.join(__dirname, 'src', 'models'),
	},
	//init options and so on
	initialize: require('./src/common/initialize.js')
};
