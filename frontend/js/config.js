// config.js - AUTO-DETECT VERSION
const ipSekarang = window.location.hostname;
let apiBaseUrl;

if (ipSekarang === 'localhost' || ipSekarang === '127.0.0.1') {
    apiBaseUrl = 'http://localhost';
} else if (ipSekarang === '10.177.42.32') {
    apiBaseUrl = 'http://10.177.42.32';
} else if (ipSekarang === '172.16.18.209') {
    apiBaseUrl = 'http://172.16.18.209';
} else {
    apiBaseUrl = 'http://192.168.43.32'; // default
// } else {
//     apiBaseUrl = 'http://172.16.18.209'; // defaul
}


// Tambahkan fungsi helper untuk build URL
window.APP_CONFIG = { 
    API_BASE_URL: apiBaseUrl,
    getApiUrl: (endpoint) => {
        // Pastikan endpoint dimulai dengan slash
        const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
        return `${apiBaseUrl}/api${normalizedEndpoint}`;
    }
};