// test-server.js
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/health',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('Error testing server:', err.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Timeout: Server tidak merespons');
  req.destroy();
  process.exit(1);
});

req.end();