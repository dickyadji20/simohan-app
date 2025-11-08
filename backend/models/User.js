const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  // Method untuk mencari pengguna berdasarkan username
  static async findByUsername(username) {
    const query = 'SELECT * FROM users WHERE username = $1';
    const values = [username];
    
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Method untuk memverifikasi password
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Method untuk membuat pengguna baru (jika diperlukan)
  static async create(userData) {
    const { username, password, nama, role } = userData;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const query = `
      INSERT INTO users (username, password, nama, role) 
      VALUES ($1, $2, $3, $4) 
      RETURNING id, username, nama, role
    `;
    const values = [username, hashedPassword, nama, role];
    
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User;