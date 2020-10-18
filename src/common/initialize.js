
const OPTS_PREFIX = 'orders';
const DEFAULTS = {
  redirect_of_requests_to_other_server: false,
  redirect_of_requests_to_other_server_url: '/some/other/server'
};

function initialize(app){
  try{
    app.logger.log('init options...');
    let finalOpts = {};
    for(let t in DEFAULTS){
      finalOpts[`${OPTS_PREFIX}:${t}`] = {
        value: DEFAULTS[t],
        active: true,
      }
    }
    let Options = app.getModel('Options');
    app.logger.log(finalOpts);
    Options.initIfNotExists(finalOpts).catch(e => app.logger.error(e) );
  }catch(e){
    app.logger.error(e);
  }
}


module.exports = initialize;
