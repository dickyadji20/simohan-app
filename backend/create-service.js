// create-service.js
const Service = require('node-windows').Service;

// Create a new service object
const svc = new Service({
  name: 'WebsiteNodeServer',
  description: 'Node.js Website Server on Port 80',
  script: 'C:\\Users\\Me\\Desktop\\project\\backend\\server.js',
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=2048'
  ],
  env: [{
    name: "PORT",
    value: 80
  }]
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', function() {
  console.log('Service installed successfully!');
  svc.start();
  console.log('Service started!');
});

svc.on('alreadyinstalled', function() {
  console.log('Service is already installed.');
});

svc.on('start', function() {
  console.log('Service started!');
});

// Install the service
svc.install();