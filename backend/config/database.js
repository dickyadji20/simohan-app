const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'monitoring_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'monitoring_db',
  password: process.env.DB_PASSWORD || 'admin123',
  port: process.env.DB_PORT || 5432,
});

// Test koneksi database
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  console.log('Terhubung ke database PostgreSQL');
  release();
});

module.exports = pool;