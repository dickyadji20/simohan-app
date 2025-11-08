const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Middleware untuk autentikasi API key
const authenticateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (apiKey && apiKey === process.env.ESP32_API_KEY) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// POST /api/rfid/log - untuk log aktivitas
router.post('/log', authenticateApiKey, async (req, res) => {
    try {
        const { rfid_uid, nama_petugas, kode_ruangan } = req.body;
        
        console.log('Received RFID log:', { rfid_uid, nama_petugas, kode_ruangan });
        
        // Validasi input
        if (!rfid_uid) {
            return res.status(400).json({ error: 'RFID UID diperlukan' });
        }
        
        // Simpan data ke database
        const query = `
            INSERT INTO logs_rfid (rfid_uid, nama_petugas, kode_ruangan) 
            VALUES ($1, $2, $3) 
            RETURNING *`;
        
        const values = [rfid_uid, nama_petugas || 'Petugas RFID', kode_ruangan || 'Ruangan RFID'];
        const result = await pool.query(query, values);
        
        console.log('Data saved to database:', result.rows[0]);
        
        res.status(201).json({ 
            success: true, 
            message: 'Data RFID berhasil disimpan',
            data: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error menyimpan data RFID:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// POST /api/rfid/register - untuk pendaftaran kartu baru
router.post('/register', authenticateApiKey, async (req, res) => {
    try {
        const { rfid_uid, nama_petugas, kode_ruangan } = req.body;
        
        console.log('Received RFID register:', { rfid_uid, nama_petugas, kode_ruangan });
        
        // Validasi input
        if (!rfid_uid || !nama_petugas || !kode_ruangan) {
            return res.status(400).json({ 
                error: 'RFID UID, nama petugas, dan kode ruangan diperlukan' 
            });
        }
        
        // Simpan data petugas ke database
        const query = `
            INSERT INTO petugas_rfid (rfid_uid, nama_petugas, kode_ruangan) 
            VALUES ($1, $2, $3) 
            ON CONFLICT (rfid_uid) 
            DO UPDATE SET nama_petugas = $2, kode_ruangan = $3
            RETURNING *`;
        
        const values = [rfid_uid, nama_petugas, kode_ruangan];
        const result = await pool.query(query, values);
        
        console.log('Petugas registered:', result.rows[0]);
        
        res.status(201).json({ 
            success: true, 
            message: 'Petugas berhasil didaftarkan',
            data: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error mendaftarkan petugas:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// GET /api/rfid/logs - untuk melihat log
router.get('/logs', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        
        const query = `
            SELECT * FROM logs_rfid 
            ORDER BY waktu DESC 
            LIMIT $1 OFFSET $2`;
        
        const result = await pool.query(query, [parseInt(limit), parseInt(offset)]);
        
        res.json({ 
            success: true,
            data: result.rows,
            total: result.rowCount
        });
    } catch (error) {
        console.error('Error mengambil data log RFID:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;