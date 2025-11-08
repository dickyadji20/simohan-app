const db = require('../config/database');
const { sendTelegramNotification, sendErrorNotification } = require('../services/telegramService');

console.log('🔧 RFID Controller loaded');

const rfidController = {
    // Log RFID access
    logRFID: async (req, res) => {
        console.log('\n=== RFID LOG REQUEST ===');
        console.log('Body:', req.body);
        
        try {
            const { card_uid } = req.body;
            
            if (!card_uid) {
                console.log('❌ Missing card_uid');
                return res.status(400).json({ error: 'Card UID is required' });
            }
            
            console.log('🔍 Checking card:', card_uid);
            
            // Cek apakah kartu terdaftar
            const cardQuery = 'SELECT * FROM rfid_cards WHERE card_uid = ?';
            const [cardRows] = await db.execute(cardQuery, [card_uid]);
            
            if (cardRows.length === 0) {
                console.log('❌ Card not registered:', card_uid);
                await sendErrorNotification('Kartu tidak terdaftar mencoba akses', card_uid);
                return res.status(404).json({ error: 'Kartu tidak terdaftar' });
            }
            
            const cardDetails = cardRows[0];
            console.log('✅ Card found:', cardDetails.petugas_name);
            
            // Simpan log ke database
            const logQuery = 'INSERT INTO rfid_logs (card_uid, petugas_name, ruangan) VALUES (?, ?, ?)';
            const [logResult] = await db.execute(logQuery, [card_uid, cardDetails.petugas_name, cardDetails.ruangan]);
            
            console.log('✅ Log saved with ID:', logResult.insertId);
            
            // Kirim notifikasi Telegram
            console.log('📤 Sending Telegram notification...');
            const telegramSuccess = await sendTelegramNotification(
                'Akses Diterima ✅',
                card_uid,
                cardDetails.petugas_name,
                cardDetails.ruangan
            );
            
            // Response ke ESP32
            res.json({ 
                success: true, 
                message: 'Log berhasil dicatat',
                log_id: logResult.insertId,
                petugas_name: cardDetails.petugas_name,
                ruangan: cardDetails.ruangan,
                telegram_sent: telegramSuccess
            });
            
        } catch (error) {
            console.error('❌ Error in logRFID:', error);
            await sendErrorNotification(error.message, req.body.card_uid || 'Unknown');
            res.status(500).json({ error: 'Terjadi kesalahan server' });
        }
    },
    
    // Check card status
    checkCard: async (req, res) => {
        try {
            const { uid } = req.query;
            console.log('🔍 Check card request:', uid);
            
            if (!uid) {
                return res.status(400).json({ error: 'UID is required' });
            }
            
            const query = 'SELECT * FROM rfid_cards WHERE card_uid = ?';
            const [rows] = await db.execute(query, [uid]);
            
            if (rows.length > 0) {
                res.json({
                    registered: true,
                    petugas_name: rows[0].petugas_name,
                    ruangan: rows[0].ruangan
                });
            } else {
                res.json({
                    registered: false
                });
            }
        } catch (error) {
            console.error('Error checking card:', error);
            res.status(500).json({ error: 'Terjadi kesalahan server' });
        }
    },
    
    // Register new card
    registerCard: async (req, res) => {
        try {
            const { card_uid } = req.body;
            
            if (!card_uid) {
                return res.status(400).json({ error: 'Card UID is required' });
            }
            
            // Cek apakah kartu sudah terdaftar
            const checkQuery = 'SELECT * FROM rfid_cards WHERE card_uid = ?';
            const [checkRows] = await db.execute(checkQuery, [card_uid]);
            
            if (checkRows.length > 0) {
                return res.status(400).json({ error: 'Kartu sudah terdaftar' });
            }
            
            // Daftarkan kartu baru
            const insertQuery = 'INSERT INTO rfid_cards (card_uid, petugas_name, ruangan) VALUES (?, "Belum diisi", "Belum diisi")';
            const [result] = await db.execute(insertQuery, [card_uid]);
            
            // Kirim notifikasi pendaftaran baru
            await sendTelegramNotification(
                'Kartu Baru Terdaftar 📝',
                card_uid,
                'Belum diisi',
                'Belum diisi'
            );
            
            res.json({ 
                success: true, 
                message: 'Kartu berhasil didaftarkan',
                card_id: result.insertId
            });
            
        } catch (error) {
            console.error('Error registering card:', error);
            res.status(500).json({ error: 'Terjadi kesalahan server' });
        }
    }
};

// Pastikan controller diekspor dengan benar
module.exports = rfidController;