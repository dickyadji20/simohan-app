// check-server.js
const http = require('http');

function checkServer() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/health',
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode === 200 && result.success) {
            resolve({ success: true, message: 'Server berjalan dengan baik', data: result });
          } else {
            resolve({ success: false, message: 'Server tidak merespons dengan benar', data: result });
          }
        } catch (e) {
          resolve({ success: false, message: 'Response tidak valid dari server' });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, message: `Tidak dapat terhubung ke server: ${err.message}` });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, message: 'Timeout: Server tidak merespons' });
    });

    req.end();
  });
}

// Jalankan pengecekan server
checkServer().then(result => {
  console.log(result.success ? '✅' : '❌', result.message);
  if (result.data) {
    console.log('Data:', result.data);
  }
  process.exit(result.success ? 0 : 1);
});