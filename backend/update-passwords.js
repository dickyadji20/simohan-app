const bcrypt = require('bcryptjs');
const pool = require('./config/database');

async function updatePasswords() {
  try {
    console.log('Memperbarui password di database...');
    
    // Hash password yang benar
    const hashedPasswordAdmin = await bcrypt.hash('password123', 10);
    const hashedPasswordPetugas = await bcrypt.hash('password123', 10);
    
    console.log('Password admin yang di-hash:', hashedPasswordAdmin);
    console.log('Password petugas yang di-hash:', hashedPasswordPetugas);
    
    // Update password di database
    const client = await pool.connect();
    
    // Update password untuk admin
    await client.query(
      'UPDATE users SET password = $1 WHERE username = $2',
      [hashedPasswordAdmin, 'admin']
    );
    
    // Update password untuk petugas
    await client.query(
      'UPDATE users SET password = $1 WHERE username = $2',
      [hashedPasswordPetugas, 'petugas']
    );
    
    console.log('Password berhasil diupdate di database');
    
    // Verifikasi password yang baru
    const verifyAdmin = await bcrypt.compare('password123', hashedPasswordAdmin);
    const verifyPetugas = await bcrypt.compare('password123', hashedPasswordPetugas);
    
    console.log('Verifikasi password admin:', verifyAdmin);
    console.log('Verifikasi password petugas:', verifyPetugas);
    
    client.release();
  } catch (error) {
    console.error('Error updating passwords:', error);
  } finally {
    pool.end();
  }
}

updatePasswords();