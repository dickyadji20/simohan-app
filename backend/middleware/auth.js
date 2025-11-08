const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_monitoring_kebersihan';

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token akses diperlukan' 
      });
    }

    // Verifikasi token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Verifikasi user masih ada di database
    const userResult = await pool.query(
      'SELECT id, username, role FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token tidak valid' 
      });
    }

    req.user = userResult.rows[0];
    next();
  } catch (error) {
    console.error('Error autentikasi:', error);
    return res.status(403).json({ 
      success: false, 
      message: 'Token tidak valid atau telah kedaluwarsa' 
    });
  }
};

module.exports = authenticateToken;