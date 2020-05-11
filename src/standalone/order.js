import './order.scss';
import OrderComponent from './order.svelte';

function launchOrderForm(options = {}){
  return new Promise((resolve, reject)=>{
    try{
      let comp = new OrderComponent({
        target: document.body,
        props: {
          closeButton: false,
          closeOnClick: true,
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
