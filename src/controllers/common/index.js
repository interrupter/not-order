export default class Common{
	static PACKAGE = 'not-order';
	static MODULE = {
		name: 'Orders',
		label: 'Управление заказами'
	};
	static DEFAULT_REDIRECT_TIMEOUT = 5000;
	static CLASS_OK = 'is-success';
	static CLASS_ERR = 'is-danger';
  static isError(e){
    return e instanceof Error;
  }
};
