const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Enable CORS untuk semua route
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Konfigurasi multer untuk upload file
const uploadDir = 'assets/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cleaning-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diizinkan!'), false);
    }
  }
});

// ==================== ENDPOINT UTAMA ====================

// GET endpoint untuk mengambil daftar petugas dan ruangan mereka
router.get('/daftar-petugas-ruangan', async (req, res) => {
    console.log('🔍 Endpoint /daftar-petugas-ruangan diakses');
    
    try {
        // QUERY 1: Ambil dari rfid_cards + rfid_ruangan_relasi (seperti pendaftarankartu.html)
        const queryRFID = `
            SELECT 
                rc.petugas_name,
                dr.nama_ruangan
            FROM rfid_cards rc
            LEFT JOIN rfid_ruangan_relasi rrr ON rc.id = rrr.rfid_card_id
            LEFT JOIN daftar_ruangan dr ON rrr.ruangan_id = dr.id
            WHERE rc.petugas_name IS NOT NULL 
            AND rc.petugas_name != ''
            AND rc.status = 'active'
        `;

        // QUERY 2: Ambil dari daftar_ruangan langsung (fallback)
        const queryDaftarRuangan = `
            SELECT DISTINCT 
                COALESCE(petugas_kebersihan, 'Belum diassign') as petugas_name,
                nama_ruangan 
            FROM daftar_ruangan 
            WHERE petugas_kebersihan IS NOT NULL 
            AND petugas_kebersihan != ''
            AND nama_ruangan IS NOT NULL
        `;

        console.log('📊 Menjalankan query RFID...');
        const resultRFID = await pool.query(queryRFID);
        console.log('📊 Menjalankan query Daftar Ruangan...');
        const resultDaftarRuangan = await pool.query(queryDaftarRuangan);

        // Gabungkan hasil kedua query
        const combinedResults = [...resultRFID.rows, ...resultDaftarRuangan.rows];
        console.log('✅ Data gabungan:', combinedResults);

        // Format data untuk petugas dan ruangan mereka
        const petugasMap = {};
        combinedResults.forEach(row => {
            const petugas = row.petugas_name;
            if (petugas && petugas !== 'Belum diassign') {
                if (!petugasMap[petugas]) {
                    petugasMap[petugas] = new Set(); // Gunakan Set untuk hindari duplikat
                }
                if (row.nama_ruangan) {
                    petugasMap[petugas].add(row.nama_ruangan);
                }
            }
        });


// GET endpoint untuk mendapatkan mapping petugas dan ruangan
router.get('/petugas-ruangan-mapping', async (req, res) => {
    try {
        // Query untuk mendapatkan data dari rfid_ruangan_relasi dan daftar_ruangan
        const query = `
            SELECT 
                rc.petugas_name,
                dr.nama_ruangan,
                dr.id as ruangan_id
            FROM rfid_cards rc
            JOIN rfid_ruangan_relasi rrr ON rc.id = rrr.rfid_card_id
            JOIN daftar_ruangan dr ON rrr.ruangan_id = dr.id
            WHERE rc.petugas_name IS NOT NULL 
            AND rc.petugas_name != ''
            AND rc.status = 'active'
            UNION
            SELECT 
                petugas_kebersihan as petugas_name,
                nama_ruangan,
                id as ruangan_id
            FROM daftar_ruangan
            WHERE petugas_kebersihan IS NOT NULL
            AND petugas_kebersihan != ''
            ORDER BY petugas_name, nama_ruangan
        `;

        const result = await pool.query(query);
        
        // Format data menjadi mapping petugas -> array ruangan
        const mapping = {};
        result.rows.forEach(row => {
            if (!mapping[row.petugas_name]) {
                mapping[row.petugas_name] = [];
            }
            mapping[row.petugas_name].push({
                id: row.ruangan_id,
                nama: row.nama_ruangan
            });
        });

        res.status(200).json({
            success: true,
            data: mapping
        });
    } catch (error) {
        console.error('Error fetching petugas-ruangan mapping:', error);
        res.status(500).json({ 
            success: false,
            error: 'Terjadi kesalahan server' 
        });
    }
});

        // Convert Set to Array
        for (let petugas in petugasMap) {
            petugasMap[petugas] = Array.from(petugasMap[petugas]);
        }

        console.log('📋 Data petugas-ruangan akhir:', petugasMap);

        if (Object.keys(petugasMap).length > 0) {
            res.status(200).json({
                success: true,
                data: petugasMap,
                source: 'combined'
            });
        } else {
            // Fallback ke data sample
            console.log('⚠️ Data kosong, menggunakan data sample');
            const sampleData = {
                "Harits Fakhuni Zainuddin, S.Kom": [
                    "Koridor Atas Depan",
                    "Koridor Atas Kiri", 
                    "Rg. Panitera Pengganti",
                    "Rg. Pantry",
                    "Rg. Server",
                    "Toilet Atas Pria"
                ],
                "M. Nazar, SH": [
                    "Kesekretariatan",
                    "Koridor Bawah Kiri",
                    "Ruang Bendahara", 
                    "Ruang Mediasi"
                ],
                "Muh. Risal": [
                    "Media Center",
                    "Toilet Dilabel",
                    "Koridor Atas Kanan",
                    "Perpustakaan",
                    "Koridor Atas Belakang"
                ]
            };
            res.status(200).json({
                success: true,
                data: sampleData,
                source: 'sample'
            });
        }
        
    } catch (error) {
        console.error('❌ Error fetching data:', error);
        
        // Fallback ke data sample jika semua gagal
        const sampleData = {
            "Harits Fakhuni Zainuddin, S.Kom": [
                "Koridor Atas Depan",
                "Koridor Atas Kiri", 
                "Rg. Panitera Pengganti",
                "Rg. Pantry",
                "Rg. Server",
                "Toilet Atas Pria"
            ],
            "M. Nazar, SH": [
                "Kesekretariatan",
                "Koridor Bawah Kiri",
                "Ruang Bendahara",
                "Ruang Mediasi"
            ],
            "Muh. Risal": [
                "Media Center", 
                "Toilet Dilabel",
                "Koridor Atas Kanan",
                "Perpustakaan",
                "Koridor Atas Belakang"
            ]
        };
        
        res.status(200).json({
            success: true,
            data: sampleData,
            source: 'emergency_fallback',
            error: error.message
        });
    }
});

// POST endpoint untuk laporan kebersihan - versi sederhana
router.post('/', upload.single('foto'), async (req, res) => {
    let client;
    try {
        console.log('📨 Received POST request to /api/cleaning');
        console.log('Body:', req.body);
        console.log('File:', req.file);

        const { petugas, tanggal, ruangan, catatan } = req.body;
        const foto = req.file ? req.file.filename : null;

        // Validasi data wajib
        if (!petugas || !tanggal || !ruangan) {
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ 
                success: false,
                error: 'Data yang diperlukan tidak lengkap',
                details: 'Pastikan petugas, tanggal, dan ruangan diisi'
            });
        }

        client = await pool.connect();

        // Simpan ke database - untuk sekarang simpan sebagai satu record
        const query = `
            INSERT INTO laporan_kebersihan (petugas, tanggal, ruangan, catatan, foto, status_validasi)
            VALUES ($1, $2, $3, $4, $5, 'belum_dicek')
            RETURNING *
        `;
        
        const values = [petugas, tanggal, ruangan, catatan || null, foto];
        const result = await client.query(query, values);

        console.log('💾 Data saved to database:', result.rows[0]);
        
        res.status(201).json({
            success: true,
            message: 'Laporan berhasil dikirim',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Error saving report:', error);
        
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            success: false,
            error: 'Terjadi kesalahan server',
            details: error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// GET endpoint untuk mengambil semua laporan
router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT *, 
                CASE 
                    WHEN status_validasi = 'sudah_dicek' THEN 'Sudah Dicek'
                    ELSE 'Belum Dicek'
                END as status_display
            FROM laporan_kebersihan 
            ORDER BY tanggal DESC, created_at DESC
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// PUT endpoint untuk update checklist
router.put('/:id/checklist', async (req, res) => {
    let client;
    try {
        const { id } = req.params;
        const {
            checklist_lantai,
            checklist_kaca_jendela,
            checklist_pintu,
            checklist_lawa_lawa,
            checklist_lubang_angin,
            checklist_kusen_jendela_dan_pintu,
            checklist_keterangan
        } = req.body;

        client = await pool.connect();

        const query = `
            UPDATE laporan_kebersihan 
            SET 
                checklist_lantai = $1,
                checklist_kaca_jendela = $2,
                checklist_pintu = $3,
                checklist_lawa_lawa = $4,
                checklist_lubang_angin = $5,
                checklist_kusen_jendela_dan_pintu = $6,
                checklist_keterangan = $7,
                status_validasi = 'sudah_dicek',
                created_at = CURRENT_TIMESTAMP
            WHERE id = $8
            RETURNING *
        `;

        const values = [
            checklist_lantai,
            checklist_kaca_jendela,
            checklist_pintu,
            checklist_lawa_lawa,
            checklist_lubang_angin,
            checklist_kusen_jendela_dan_pintu,
            checklist_keterangan,
            id
        ];

        const result = await client.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Laporan tidak ditemukan' 
            });
        }

        res.status(200).json({
            success: true,
            message: 'Checklist berhasil disimpan',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating checklist:', error);
        res.status(500).json({ 
            success: false,
            error: 'Terjadi kesalahan server' 
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// DELETE endpoint
router.delete('/:id', async (req, res) => {
    let client;
    try {
        const { id } = req.params;
        
        client = await pool.connect();
        
        // Dapatkan info foto sebelum menghapus
        const fotoQuery = 'SELECT foto FROM laporan_kebersihan WHERE id = $1';
        const fotoResult = await client.query(fotoQuery, [id]);
        
        if (fotoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Laporan tidak ditemukan' });
        }
        
        // Hapus dari database
        const deleteQuery = 'DELETE FROM laporan_kebersihan WHERE id = $1 RETURNING *';
        const result = await client.query(deleteQuery, [id]);
        
        // Hapus file foto jika ada
        const laporan = result.rows[0];
        if (laporan.foto) {
            const fotoPath = path.join(uploadDir, laporan.foto);
            if (fs.existsSync(fotoPath)) {
                fs.unlinkSync(fotoPath);
            }
        }
        
        res.status(200).json({ 
            success: true,
            message: 'Laporan berhasil dihapus',
            data: laporan
        });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ 
            success: false,
            error: 'Terjadi kesalahan server' 
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// Endpoint test sederhana
router.get('/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Endpoint cleaning works!',
        timestamp: new Date().toISOString()
    });
});


// GET endpoint untuk mendapatkan semua petugas unik dari laporan_kebersihan
router.get('/unique-petugas', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT petugas 
            FROM laporan_kebersihan 
            WHERE petugas IS NOT NULL AND petugas != '' 
            ORDER BY petugas
        `;
        const result = await pool.query(query);
        
        res.status(200).json({
            success: true,
            data: result.rows.map(row => row.petugas)
        });
    } catch (error) {
        console.error('Error fetching unique petugas:', error);
        res.status(500).json({ 
            success: false,
            error: 'Terjadi kesalahan server' 
        });
    }
});

// GET endpoint untuk mendapatkan semua ruangan unik dari daftar_ruangan
router.get('/unique-ruangan', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT nama_ruangan 
            FROM daftar_ruangan 
            WHERE nama_ruangan IS NOT NULL AND nama_ruangan != '' 
            ORDER BY nama_ruangan
        `;
        const result = await pool.query(query);
        
        res.status(200).json({
            success: true,
            data: result.rows.map(row => row.nama_ruangan)
        });
    } catch (error) {
        console.error('Error fetching unique ruangan:', error);
        res.status(500).json({ 
            success: false,
            error: 'Terjadi kesalahan server' 
        });
    }
});

// GET endpoint untuk mendapatkan mapping petugas-ruangan dari daftar_ruangan
router.get('/petugas-ruangan-daftar', async (req, res) => {
    try {
        const query = `
            SELECT 
                COALESCE(petugas_kebersihan, 'Belum diassign') as petugas,
                nama_ruangan
            FROM daftar_ruangan 
            WHERE nama_ruangan IS NOT NULL 
            ORDER BY petugas_kebersihan, nama_ruangan
        `;
        const result = await pool.query(query);
        
        // Format mapping
        const mapping = {};
        result.rows.forEach(row => {
            if (row.petugas !== 'Belum diassign') {
                if (!mapping[row.petugas]) {
                    mapping[row.petugas] = [];
                }
                mapping[row.petugas].push(row.nama_ruangan);
            }
        });
        
        res.status(200).json({
            success: true,
            data: mapping
        });
    } catch (error) {
        console.error('Error fetching petugas-ruangan dari daftar_ruangan:', error);
        res.status(500).json({ 
            success: false,
            error: 'Terjadi kesalahan server' 
        });
    }
});

// GET endpoint untuk data export PDF - VERSI TIMEZONE FIXED
router.get('/export-data', async (req, res) => {
    let client;
    try {
        const { tanggal, petugas, ruangan } = req.query;
        
        console.log('📊 Parameter export received:', { tanggal, petugas, ruangan });
        
        if (!tanggal) {
            return res.status(400).json({
                success: false,
                error: 'Parameter tanggal diperlukan'
            });
        }

        client = await pool.connect();

        // QUERY YANG DIPERBAIKI - Handle timezone Indonesia (UTC+7/UTC+8)
        let query = `
            SELECT 
                    lk.*,
                    TO_CHAR(lk.tanggal, 'YYYY-MM-DD') as tanggal_format,
                    TO_CHAR(lk.tanggal, 'DD/MM/YYYY') as tanggal_display,
                    TO_CHAR(lk.tanggal, 'HH24:MI') as waktu,
                    dr.nama_ruangan as ruangan_detail
                FROM laporan_kebersihan lk
                LEFT JOIN daftar_ruangan dr ON lk.ruangan = dr.nama_ruangan
                WHERE DATE(lk.tanggal + INTERVAL '7 HOUR') = $1  -- Adjust for UTC+7
            `;
                    
        const params = [tanggal];
        let paramCount = 1;

        if (petugas && petugas !== '') {
            paramCount++;
            query += ` AND lk.petugas = $${paramCount}`;
            params.push(petugas);
        }

        if (ruangan && ruangan !== '') {
            paramCount++;
            query += ` AND lk.ruangan ILIKE '%' || $${paramCount} || '%'`;
            params.push(ruangan);
        }

        query += ` ORDER BY lk.ruangan, lk.tanggal ASC`;

        console.log('📋 Query export (Timezone Fixed):', query);
        console.log('🔢 Parameters:', params);

        const result = await client.query(query, params);
        
        console.log('✅ Data found:', result.rows.length, 'records');
        
        // Debug detail data
        if (result.rows.length > 0) {
            console.log('📝 Data details with timezone conversion:');
            result.rows.forEach((row, index) => {
                console.log(`  Record ${index + 1}:`, {
                    id: row.id,
                    tanggal_original: row.tanggal,
                    tanggal_local: row.tanggal_local,
                    tanggal_display: row.tanggal_display,
                    petugas: row.petugas,
                    ruangan: row.ruangan
                });
            });
        }
        
        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('❌ Error fetching export data:', error);
        res.status(500).json({ 
            success: false,
            error: 'Terjadi kesalahan server',
            details: error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// GET endpoint untuk mendapatkan data petugas lengkap dengan foto
router.get('/petugas-lengkap', async (req, res) => {
    try {
        const query = `
            SELECT 
                rc.id,
                rc.petugas_name,
                rc.foto_petugas,
                STRING_AGG(DISTINCT dr.nama_ruangan, ', ') as ruangan
            FROM rfid_cards rc
            LEFT JOIN rfid_ruangan_relasi rrr ON rc.id = rrr.rfid_card_id
            LEFT JOIN daftar_ruangan dr ON rrr.ruangan_id = dr.id
            WHERE rc.petugas_name IS NOT NULL 
            AND rc.petugas_name != ''
            AND rc.status = 'active'
            GROUP BY rc.id, rc.petugas_name, rc.foto_petugas
            ORDER BY rc.petugas_name
        `;
        
        const result = await pool.query(query);
        
        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching petugas lengkap:', error);
        res.status(500).json({ 
            success: false,
            error: 'Terjadi kesalahan server' 
        });
    }
});

module.exports = router;