import CommonLocal from '../common/index.js';
import Validators from '../common/validators.js';
import {
	notController,
} from 'not-bulma';

const LABELS = {
	plural: 'Заказы',
	single: 'Заказ',
};

const MODEL = 'Order';

class ncOrder extends notController{
  constructor(app, params, schemes){
    super(app, MODEL);
		this.setModuleName(CommonLocal.MODULE.name);
		this.setModelName(MODEL);
		this.setOptions('names', LABELS);
		this.setOptions('Validators', Validators);
		this.setOptions('params', params);
		this.setOptions('role', 'root');
		this.setOptions('urlSchemes', schemes);
  }
}

export default ncOrder;
