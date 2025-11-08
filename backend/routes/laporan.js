const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Enable CORS untuk semua route
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// POST endpoint untuk menyimpan laporan
router.post('/', async (req, res) => {
    console.log('Received POST request to /api/laporan');
    console.log('Request body:', req.body);
    
    const { ruangan, tanggal, pengguna, catatan } = req.body;

    // Validasi input
    if (!ruangan || !tanggal || !pengguna) {
        return res.status(400).json({
            success: false,
            message: 'Field ruangan, tanggal, dan pengguna harus diisi'
        });
    }

    try {
        // Simpan data ke database
        const query = `
            INSERT INTO laporan_kebutuhan (ruangan, tanggal, pengguna, catatan)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        
        const values = [ruangan, tanggal, pengguna, catatan || ''];
        const result = await pool.query(query, values);
        
        console.log('Data saved successfully:', result.rows[0]);
        
        // Kirim notifikasi Telegram (fire and forget - tidak blocking)
        if (req.app && req.app.locals.sendTelegramNotification) {
            req.app.locals.sendTelegramNotification(result.rows[0])
                .then(success => {
                    if (success) {
                        console.log('Notifikasi Telegram terkirim');
                    } else {
                        console.log('Gagal mengirim notifikasi Telegram');
                    }
                })
                .catch(err => {
                    console.error('Error dalam pengiriman Telegram:', err);
                });
        } else {
            console.log('Fungsi Telegram tidak tersedia');
        }

        res.status(201).json({
            success: true,
            message: 'Laporan berhasil disimpan',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error menyimpan laporan:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server: ' + error.message
        });
    }
});

// GET endpoint untuk mengambil daftar laporan
router.get('/', async (req, res) => {
    console.log('Received GET request to /api/laporan');
    
    try {
        const query = `
            SELECT id, ruangan, tanggal, pengguna, catatan, created_at
            FROM laporan_kebutuhan
            ORDER BY created_at DESC
        `;
        
        const result = await pool.query(query);
        
        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error mengambil data laporan:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server'
        });
    }
});

// DELETE endpoint untuk menghapus laporan
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    console.log('Menerima permintaan DELETE untuk ID:', id);

    // Validasi input
    if (!id || isNaN(id)) {
        return res.status(400).json({
            success: false,
            message: 'ID laporan tidak valid'
        });
    }

    try {
        // Periksa apakah laporan exist
        const checkQuery = 'SELECT * FROM laporan_kebutuhan WHERE id = $1';
        const checkResult = await pool.query(checkQuery, [id]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Laporan tidak ditemukan'
            });
        }

        // Hapus data dari database
        const query = 'DELETE FROM laporan_kebutuhan WHERE id = $1';
        const result = await pool.query(query, [id]);
        
        console.log('Data berhasil dihapus dengan ID:', id);
        
        res.status(200).json({
            success: true,
            message: 'Laporan berhasil dihapus'
        });
    } catch (error) {
        console.error('Error menghapus laporan:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server: ' + error.message
        });
    }
});

// Handle OPTIONS method for CORS preflight
router.options('/', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.sendStatus(200);
});

module.exports = router;