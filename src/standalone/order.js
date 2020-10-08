import './order.scss';
import OrderComponent from './order.svelte';
import OrderManifest from './order.manifest.js';
import OrderValidators from './validators.js';
import {Form, LIB} from 'not-bulma';

LIB.FIELDS.import(OrderManifest.fields);

function launchOrderForm(options = {}){
  return new Promise((resolve, reject)=>{
    try{
      let validatorOptions = {};
      Form.actionFieldsInit(OrderManifest.actions.add.fields, validatorOptions, OrderValidators, options.data);
      let comp = new OrderComponent({
        target: document.body,
        props: {
          closeButton: false,
          closeOnClick: true,
          manifest: OrderManifest,
          validators: OrderValidators,
          options: validatorOptions,
          ...options
        }
      });
      comp.$on('resolve', ev => resolve(ev.detail));
      comp.$on('reject', reject);
    }catch(e){
      reject(e);
    }
  });
}

export { OrderComponent,  launchOrderForm};
