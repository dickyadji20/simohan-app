const express = require('express');
const cors = require('cors');
const path = require('path');
const cleaningRoutes = require('./routes/cleaning');
const app = express();
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');
const laporanRoutes = require('./routes/laporan');
const ruanganRoutes = require('./routes/ruangan');
const authenticateToken = require('./middleware/auth');
const multer = require('multer');
const pool = require('./config/database');
const axios = require('axios'); //sudah di-install


// ========== KONFIGURASI TELEGRAM NOTIFICATION ==========
const TELEGRAM_CONFIG = {
  BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN_LAPORAN || '8533459774:AAE4bDvnLdrWcNkFRdNsWH2ZxQUeseNaJLQ',
  CHAT_ID: process.env.TELEGRAM_CHAT_ID_LAPORAN || '7941223807'
};

// Fungsi untuk mengirim notifikasi Telegram
const sendTelegramNotification = async (laporanData) => {
  try {
    const message = `
🚨 *LAPORAN KEBUTUHAN KEBERSIHAN BARU*

🏢 *Ruangan:* ${laporanData.ruangan}
👤 *Pengguna:* ${laporanData.pengguna}
📅 *Tanggal:* ${laporanData.tanggal}
📝 *Catatan:* ${laporanData.catatan || 'Tidak ada catatan'}

⏰ *Waktu Laporan:* ${new Date().toLocaleString('id-ID')}

🔗 _Silakan buka dashboard untuk validasi_
    `.trim();

    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_CONFIG.BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CONFIG.CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      }
    );

    console.log('Notifikasi Telegram berhasil dikirim');
    return true;
  } catch (error) {
    console.error('Error mengirim notifikasi Telegram:', error.message);
    return false;
  }
};

// Export fungsi untuk digunakan di route lain
app.locals.sendTelegramNotification = sendTelegramNotification;

// ========== TAMBAHKAN CODE INI ==========
// Serve static files dari folder frontend (port 80)
app.use(express.static(path.join(__dirname, '../frontend')));

// atau jika folder uploads berada di root
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Route untuk handle semua request ke frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dashboard.html'));
});

// Tambahkan route untuk setiap file HTML yang Anda punya
app.get('/logRFID.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/logRFID.html'));
});

app.get('/laporan.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/laporan.html'));
});

app.get('/pengguna.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pengguna.html'));
});

app.get('/petugas.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/petugas.html'));
});

app.get('/daftarRuangan.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/daftarRuangan.html'));
});

app.get('/kebutuhan.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/kebutuhan.html'));
});

app.get('/PendaftaranKartu.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/PendaftaranKartu.html'));
});

app.get('/login-pj.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login-pj.html'));
});

app.get('/dashboard-pj.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dashboard-pj.html'));
});

// Route khusus untuk laporan2.html
app.get('/laporan2.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/laporan2.html'));
});


app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost',          // TAMBAHKAN
            'http://127.0.0.1',          // TAMBAHKAN
            'http://192.168.43.32',     // TAMBAHKAN
            'http://172.16.18.78',       // TAMBAHKAN
            'http://localhost:5500',
            'http://127.0.0.1:5500',
            'http://192.168.43.32:5500',
            'http://192.168.1.100:5500',
            'http://172.16.18.78:5500',
            'http://192.168.43.32:3000',
            'http://192.168.1.100:3000',
            'http://172.16.18.78:3000',
            'http://172.16.18.209:5500',
            'http://172.16.18.209:3000',
            'http://172.16.18.209',
            'http://10.177.42.32:5500',
            'http://10.177.42.32:3000',
            'http://10.177.42.32',
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('192.168.1.')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Tambahkan ini setelah middleware lainnya
const rfidRoutes = require('./routes/rfid');
app.use('/api/rfid', rfidRoutes);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/asset/uploads', express.static('asset/uploads'));


// Routes
app.use('/api/cleaning', cleaningRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/laporan', laporanRoutes);
app.use('/api/ruangan', ruanganRoutes);

// Protected routes
app.use('/api/protected', authenticateToken, (req, res) => {
  // Your protected routes here
});

// Di server.js, tambahkan sebelum error handling middleware
app.get('/api/rfid/logs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, c.petugas_name, c.ruangan 
      FROM rfid_logs l 
      LEFT JOIN rfid_cards c ON l.card_uid = c.card_uid 
      ORDER BY l.waktu DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching RFID logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Handle multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File terlalu besar' });
    }
  }
  
  res.status(500).json({ 
    error: 'Terjadi kesalahan server',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Silakan coba lagi nanti'
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

// Handle SPA routing - serve index.html for all other requests
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

const os = require('os');

function getServerIP() {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    for (const iface of interfaces[interfaceName]) {
      // Hanya IPv4 dan tidak internal
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const PORT =80;
// Jalankan server pada semua network interface
app.listen(PORT, '0.0.0.0', () => {
});