const { findByUsername } = require('./models/User');
const bcrypt = require('bcryptjs');

async function testUserModel() {
  try {
    console.log('Testing User.findByUsername...');
    
    // Test mencari user admin
    const admin = await findByUsername('admin');
    console.log('Admin found:', admin ? 'Yes' : 'No');
    
    if (admin) {
      console.log('Testing password verification for admin...');
      const isValidAdmin = await bcrypt.compare('password123', admin.password);
      console.log('Admin password valid:', isValidAdmin);
      
      // Jika password tidak valid, tampilkan perbandingan
      if (!isValidAdmin) {
        console.log('Hash yang tersimpan:', admin.password);
        const testHash = await bcrypt.hash('password123', 10);
        console.log('Hash baru untuk comparison:', testHash);
      }
    }
    
    // Test mencari user petugas
    const petugas = await findByUsername('petugas');
    console.log('Petugas found:', petugas ? 'Yes' : 'No');
    
    if (petugas) {
      console.log('Testing password verification for petugas...');
      const isValidPetugas = await bcrypt.compare('password123', petugas.password);
      console.log('Petugas password valid:', isValidPetugas);
    }
    
  } catch (error) {
    console.error('Error testing User model:', error);
  }
}

testUserModel();