const bcrypt = require('bcryptjs');

async function createHashes() {
  console.log('Membuat hash untuk password:');
  console.log('Password: password123');
  
  // Buat beberapa hash untuk dilihat perbedaannya
  for (let i = 0; i < 3; i++) {
    const hash = await bcrypt.hash('password123', 10);
    console.log(`Hash ${i + 1}: ${hash}`);
    
    // Verifikasi hash
    const isValid = await bcrypt.compare('password123', hash);
    console.log(`Hash ${i + 1} valid: ${isValid}`);
    console.log('---');
  }
}

createHashes();