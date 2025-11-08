console.log('=== TEST IMPORT CONTROLLER ===');

try {
    console.log('1. Testing database connection...');
    const db = require('./config/database');
    console.log('✅ Database connection OK');
    
    console.log('2. Testing Telegram service...');
    const telegram = require('./services/telegramService');
    console.log('✅ Telegram service OK');
    
    console.log('3. Testing RFID controller...');
    const rfidController = require('./controllers/rfidController');
    console.log('✅ RFID controller OK');
    
    console.log('4. Testing functions...');
    console.log('   logRFID:', typeof rfidController.logRFID);
    console.log('   checkCard:', typeof rfidController.checkCard);
    console.log('   registerCard:', typeof rfidController.registerCard);
    
    console.log('🎉 All imports successful!');
    
} catch (error) {
    console.error('❌ Import error:', error.message);
    console.error('Stack:', error.stack);
}