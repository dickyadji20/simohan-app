const User = require('../models/User');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_monitoring_kebersihan';

const authController = {
  // Login pengguna
  login: async (req, res) => {
    const { username, password } = req.body;

    try {
      // Validasi input
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username dan password harus diisi'
        });
      }

      // Cari pengguna berdasarkan username
      const user = await User.findByUsername(username);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Username atau password salah'
        });
      }

      // Verifikasi password
      const isPasswordValid = await User.verifyPassword(password, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Username atau password salah'
        });
      }

      // Buat token JWT
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          nama: user.nama, 
          role: user.role 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Kirim response sukses
      res.json({
        success: true,
        message: 'Login berhasil',
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            nama: user.nama,
            role: user.role
          }
        }
      });

    } catch (error) {
      console.error('Error saat login:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server'
      });
    }
  },

  // Verifikasi token (jika diperlukan)
  verifyToken: (req, res) => {
    // Middleware auth.js akan menambahkan user ke request object
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  }
};

module.exports = authController;