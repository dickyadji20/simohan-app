const pool = require('./config/database');

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Koneksi database berhasil');
    
    // Test query sederhana
    const result = await client.query('SELECT NOW() as current_time');
    console.log('Waktu sekarang:', result.rows[0].current_time);
    
    // Test query ke tabel users
    const usersResult = await client.query('SELECT * FROM users');
    console.log('Jumlah user:', usersResult.rows.length);
    console.log('Data users:', usersResult.rows);
    
    client.release();
  } catch (error) {
    console.error('❌ Error koneksi database:', error);
  } finally {
    await pool.end();
  }
}

testConnection();