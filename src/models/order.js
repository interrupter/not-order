const
	Schema = require('mongoose').Schema,
	notError = require('not-error').notError,
	notLocale = require('not-locale');

	exports.thisModelName = 'Order';
	exports.keepNotExtended = false;

	exports.enrich = {
		versioning: true,
		increment: true,
		validators: true
	};

	exports.thisSchema = {		
		sessionId:{
			type: String,
			required: true,
		},
		user:{
			type: 			Schema.Types.ObjectId,
			ref: 				'User',
			required: 	false
		},
		client:{
			type: Schema.Types.Mixed,
			searchable: true,
			required: true
		},
		content:{
			type: [Schema.Types.Mixed],
			searchable: true,
			required: true,
		},
		status: {
			type: String,
			required: true,
			default: 'new'
		},
		ip: {
			type: String,
			required: false,
			validate: [
				{
					validator: 'isIP',
					message: 'ip_address_is_not_valid'
				}
			]
		},
		created: {
			type: Date,
			default: Date.now
		},
		updated: {
			type: Date,
			default: Date.now
		},
	};

	exports.thisStatics = {

	};

	exports.thisMethods = {

	};
