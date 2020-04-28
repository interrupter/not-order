const connect = require('connect'),
  path = require('path'),
  serveStatic = require('serve-static'),

  exec = require('child_process').exec;

let type = process.env.TEST_TYPE;

function runTests(){
  	return new Promise((res, rej) => {
  		try {
  			exec(`./node_modules/.bin/cypress ${type}`, {}, (err, stdout) => {
          console.log(stdout);
  					if (err) {
  						rej(err);
  					} else {
  						res();
  					}
  			});
  		} catch (e) {
  			rej(e);
  		}
    });
  };


function startServer(){
  connect().use(serveStatic(path.join(__dirname,'./browser'))).listen(7357, function(){
      console.log('Test server running on 7357...');
  });
}

startServer();

runTests().then(()=>{
  process.exit(0);
}).catch((e)=>{
  console.error(e);
  process.exit(1);
});
