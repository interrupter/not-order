const connect = require('connect'),
  path = require('path'),
  serveStatic = require('serve-static'),
  exec = require('child_process').exec;

function startServer(){
  connect().use(serveStatic(path.join(__dirname,'./browser'))).listen(7357, function(){
      console.log('Test server running on 7357...');
  });
}

startServer();
