const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const pool = require('../config/database');
const jwt = require('jsonwebtoken');


// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validasi input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username dan password diperlukan'
      });
    }

    // Cari user di database
    const userResult = await pool.query(
      'SELECT id, username, password, role FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah'
      });
    }

    const user = userResult.rows[0];

    // Verifikasi password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah'
      });
    }

    // Buat token JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username,
        role: user.role 
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );

    // Hapus password dari response
    delete user.password;

    res.json({
      success: true,
      message: 'Login berhasil',
      token,
      user
    });
  } catch (error) {
    console.error('Error login:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
});

// Logout endpoint (optional)
router.post('/logout', (req, res) => {
  // Di sisi client, token akan dihapus dari localStorage
  res.json({
    success: true,
    message: 'Logout berhasil'
  });
});

module.exports = router;
