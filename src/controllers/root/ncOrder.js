import CommonLocal from '../common/index.js';
import Validators from '../common/validators.js';

import {
	ncCRUD,
} from 'not-bulma';

const LABELS = {
	plural: 'Заказы',
	single: 'Заказ',
};

const MODEL = 'order';

class ncOrder extends ncCRUD{
  constructor(app, params, schemes){
    super(app, `${CommonLocal.MODULE.name}.${MODEL}`);
		this.setModuleName(CommonLocal.MODULE.name);
		this.setModelName(MODEL);
		this.setOptions('names', LABELS);
		this.setOptions('Validators', Validators);
		this.setOptions('params', params);
		this.setOptions('role', 'root');
		this.setOptions('urlSchemes', schemes);
		this.setOptions('list', {
			fields: [{
				path: ':orderID',
				title: 'ID',
				searchable: true,
				sortable: true
			}, {
				path: ':sessionId',
				title: 'Session',
				searchable: true,
				sortable: true
			},{
				path: ':ip',
				title: 'IP',
				searchable: true,
				sortable: true
			}, {
				path: ':status',
				title: 'Статус',
				searchable: true,
				sortable: true
			}, {
				path: ':created',
				title: 'Дата создания',
				searchable: true,
				sortable: true
			}, {
				path: ':_id',
				title: 'Действия',
				type: 'button',
				preprocessor: (value) => {
					return [{
						action: this.goDetails.bind(this, value),
						title: 'Подробнее',
						size: 'small'
					}];
				},
			}]
		});
		this.start();
		return this;
  }

	createDefault() {
		let newRecord = this.make[this.getModelName()]({});
		return newRecord;
	}

}

export default ncOrder;
