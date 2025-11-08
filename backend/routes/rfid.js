const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const rfidController = require('../controllers/rfidController');

// POST /api/rfid/card - ESP32 mengirim UID untuk pendaftaran
router.post('/card', async (req, res) => {
  try {
    const { card_uid } = req.body;

    if (!card_uid) {
      return res.status(400).json({ error: 'Card UID is required' });
    }

    // Cek apakah kartu sudah ada
    const checkResult = await pool.query(
      'SELECT * FROM rfid_cards WHERE card_uid = $1',
      [card_uid]
    );

    if (checkResult.rows.length > 0) {
      return res.status(409).json({ error: 'Card already registered' });
    }

    // Simpan kartu baru dengan petugas_name dan ruangan NULL
    const result = await pool.query(
      'INSERT INTO rfid_cards (card_uid) VALUES ($1) RETURNING *',
      [card_uid]
    );

    res.status(201).json({
      message: 'Card registered successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error registering card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rfid/cards - Untuk web, ambil semua kartu
router.get('/cards', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM rfid_cards ORDER BY registered_at DESC'
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/rfid/cards/:id - Update data kartu dengan ruangan
router.put('/cards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { petugas_name, ruangan, keterangan, status } = req.body;

    // Mulai transaction
    await pool.query('BEGIN');

    // Update data kartu
    const result = await pool.query(
      'UPDATE rfid_cards SET petugas_name = $1, keterangan = $2, status = $3 WHERE id = $4 RETURNING *',
      [petugas_name, keterangan, status, id]
    );

    if (result.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Card not found' });
    }

    // Hapus relasi ruangan lama
    await pool.query('DELETE FROM rfid_ruangan_relasi WHERE rfid_card_id = $1', [id]);

    // Tambah relasi ruangan baru
    if (ruangan && ruangan.length > 0) {
      for (const ruanganId of ruangan) {
        await pool.query(
          'INSERT INTO rfid_ruangan_relasi (rfid_card_id, ruangan_id) VALUES ($1, $2)',
          [id, ruanganId]
        );
      }
    }

    // Commit transaction
    await pool.query('COMMIT');

    res.json({
      success: true,
      message: 'Card updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error updating card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// =============================================
// MIDDLEWARE: CEK PEMBATASAN TAP HARIAN
// =============================================

const checkDailyTapLimit = async (req, res, next) => {
  try {
    const { card_uid } = req.body;

    if (!card_uid) {
      return next(); // Biarkan validasi utama yang menangani
    }

    // Dapatkan tanggal hari ini (format YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`🔍 Mengecek tap harian untuk kartu: ${card_uid}, tanggal: ${today}`);

    // Cek apakah kartu sudah tap hari ini
    const existingLog = await pool.query(
      `SELECT id, waktu, petugas_name 
       FROM rfid_logs 
       WHERE card_uid = $1 
       AND DATE(waktu) = $2 
       ORDER BY waktu DESC 
       LIMIT 1`,
      [card_uid, today]
    );

    if (existingLog.rows.length > 0) {
      const lastTap = existingLog.rows[0];
      const lastTapTime = new Date(lastTap.waktu).toLocaleTimeString('id-ID');
      
      console.log(`⏰ Kartu sudah tap hari ini: ${lastTapTime}`);
      
      return res.status(429).json({ 
        success: false,
        error: 'SUDAH_TAP_HARI_INI',
        message: `Anda sudah melakukan tap hari ini pukul ${lastTapTime}`,
        lastTap: lastTap.waktu,
        petugas_name: lastTap.petugas_name
      });
    }

    console.log(`✅ Kartu belum tap hari ini, melanjutkan...`);
    next(); // Lanjut ke proses logging
  } catch (error) {
    console.error('❌ Error dalam checkDailyTapLimit:', error);
    next(); // Biarkan lewat jika ada error di pengecekan
  }
};

// =============================================
// MODIFIKASI ENDPOINT LOGGING DENGAN MIDDLEWARE
// =============================================

// POST /api/rfid/log - ESP32 mengirim log tap kartu DENGAN PEMBATASAN
router.post('/log', checkDailyTapLimit, async (req, res) => {
  try {
    const { card_uid } = req.body;

    if (!card_uid) {
      return res.status(400).json({ 
        success: false,
        error: 'Card UID is required' 
      });
    }

    console.log(`📝 Memproses logging untuk kartu: ${card_uid}`);

    // Cari data kartu beserta ruangannya
    const cardResult = await pool.query(
      `SELECT rc.*, 
              COALESCE(
                json_agg(
                  DISTINCT jsonb_build_object(
                    'id', dr.id,
                    'nama_ruangan', dr.nama_ruangan
                  )
                ) FILTER (WHERE dr.id IS NOT NULL), 
                '[]'
              ) as ruangan
       FROM rfid_cards rc
       LEFT JOIN rfid_ruangan_relasi rrr ON rc.id = rrr.rfid_card_id
       LEFT JOIN daftar_ruangan dr ON rrr.ruangan_id = dr.id
       WHERE rc.card_uid = $1
       GROUP BY rc.id`,
      [card_uid]
    );

    if (cardResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'KARTU_TIDAK_TERDAFTAR' 
      });
    }

    const card = cardResult.rows[0];
    
    // Ambil daftar nama ruangan
    const ruanganNames = card.ruangan && card.ruangan.length > 0 
      ? card.ruangan.map(r => r.nama_ruangan).join(', ') 
      : 'Belum ditugaskan';

    // Simpan log
    const logResult = await pool.query(
      `INSERT INTO rfid_logs (card_uid, petugas_name, ruangan, waktu, status) 
       VALUES ($1, $2, $3, NOW(), 'pending') RETURNING *`,
      [card_uid, card.petugas_name, ruanganNames]
    );

    const newLog = logResult.rows[0];
    
    console.log(`✅ Log berhasil disimpan: ${newLog.id}`);

    res.status(201).json({
      success: true,
      message: 'Log recorded successfully',
      data: newLog
    });

  } catch (error) {
    console.error('❌ Error recording log:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// GET /api/rfid/check-card - Untuk memeriksa status kartu
router.get('/check-card', async (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({ error: 'Card UID is required' });
    }

    const result = await pool.query(
      'SELECT * FROM rfid_cards WHERE card_uid = $1',
      [uid]
    );

    if (result.rows.length === 0) {
      return res.json({ registered: false });
    }

    const card = result.rows[0];
    res.json({
      registered: true,
      id: card.id,  // Tambahkan id
      petugas_name: card.petugas_name,
      ruangan: card.ruangan
    });
  } catch (error) {
    console.error('Error checking card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rfid/cards/:id - Untuk web, ambil satu kartu by ID
router.get('/cards/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        rc.*,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', dr.id,
              'nama_ruangan', dr.nama_ruangan
            )
          ) FILTER (WHERE dr.id IS NOT NULL), 
          '[]'
        ) as ruangan
      FROM rfid_cards rc
      LEFT JOIN rfid_ruangan_relasi rrr ON rc.id = rrr.rfid_card_id
      LEFT JOIN daftar_ruangan dr ON rrr.ruangan_id = dr.id
      WHERE rc.id = $1
      GROUP BY rc.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// DELETE /api/rfid/cards/:id - Untuk web, hapus kartu
router.delete('/cards/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM rfid_cards WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    res.json({
      success: true,
      message: 'Card deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/rfid/logs/:id - Untuk web, hapus log berdasarkan ID
router.delete('/logs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM rfid_logs WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Log not found' });
    }

    res.json({
      success: true,
      message: 'Log deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/summary - Untuk mengambil data ringkasan dashboard
router.get('/dashboard/summary', async (req, res) => {
  try {
    // Hitung jumlah ruangan bersih (ada log RFID hari ini)
    const bersihResult = await pool.query(
      `SELECT COUNT(DISTINCT rl.ruangan) as count 
       FROM rfid_logs rl
       WHERE DATE(rl.waktu) = CURRENT_DATE AND rl.ruangan IS NOT NULL AND rl.ruangan != ''`
    );
    
    // Hitung jumlah petugas aktif (ada log RFID hari ini)
    const petugasResult = await pool.query(
      `SELECT COUNT(DISTINCT rl.petugas_name) as count 
       FROM rfid_logs rl
       WHERE DATE(rl.waktu) = CURRENT_DATE AND rl.petugas_name IS NOT NULL`
    );
    
    // Total ruangan dari daftar_ruangan
    const totalRuanganResult = await pool.query(
      `SELECT COUNT(*) as count FROM daftar_ruangan`
    );
    
    const totalRuangan = totalRuanganResult.rows[0].count;
    
    // Hitung ruangan yang perlu dibersihkan (total - bersih)
    const perluPembersihan = totalRuangan - bersihResult.rows[0].count;
    
    // Hitung ruangan yang belum dicek (tidak ada log sama sekali hari ini)
    const belumDicekResult = await pool.query(
      `SELECT COUNT(*) as count 
       FROM daftar_ruangan dr
       WHERE NOT EXISTS (
         SELECT 1 FROM rfid_logs rl 
         WHERE DATE(rl.waktu) = CURRENT_DATE 
         AND rl.ruangan = dr.nama_ruangan
       )`
    );
    
    res.json({
      success: true,
      data: {
        ruangan_bersih: bersihResult.rows[0].count,
        petugas_aktif: petugasResult.rows[0].count,
        perlu_pembersihan: perluPembersihan,
        belum_dicek: belumDicekResult.rows[0].count
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route GET /api/rfid/recent-logs
 * @desc Get recent RFID logs with filters
 * @access Private
 */
router.get('/recent-logs', async (req, res) => {
    try {
        const { tanggal, ruangan, petugas, limit = 50 } = req.query;
        
        console.log('📡 Recent logs request:', { tanggal, ruangan, petugas, limit });
        
        let query = `
            SELECT 
                rl.*,
                rc.petugas_name,
                COALESCE(
                    array_agg(DISTINCT dr.nama_ruangan) FILTER (WHERE dr.nama_ruangan IS NOT NULL),
                    ARRAY[]::text[]
                ) as ruangan
            FROM rfid_logs rl
            LEFT JOIN rfid_cards rc ON rl.card_uid = rc.card_uid
            LEFT JOIN rfid_ruangan_relasi rrr ON rc.id = rrr.rfid_card_id
            LEFT JOIN daftar_ruangan dr ON rrr.ruangan_id = dr.id
            WHERE 1=1
        `;
        
        const queryParams = [];
        let paramCount = 0;
        
        // Filter tanggal
        if (tanggal) {
            paramCount++;
            query += ` AND DATE(rl.waktu) = $${paramCount}`;
            queryParams.push(tanggal);
        }
        
        // Filter petugas
        if (petugas) {
            paramCount++;
            query += ` AND rc.petugas_name = $${paramCount}`;
            queryParams.push(petugas);
        }
        
        // Filter ruangan
        if (ruangan && ruangan !== '') {
            paramCount++;
            query += ` AND dr.nama_ruangan = $${paramCount}`;
            queryParams.push(ruangan);
        }
        
        query += `
            GROUP BY rl.id, rc.petugas_name, rl.waktu
            ORDER BY rl.waktu DESC
            LIMIT $${paramCount + 1}
        `;
        
        queryParams.push(parseInt(limit));
        
        console.log('🔍 Executing query:', query);
        console.log('📊 Query params:', queryParams);
        
        const result = await pool.query(query, queryParams);
        
        console.log('✅ Query successful, rows:', result.rows.length);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('❌ Error in recent-logs endpoint:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: 'Internal server error in recent-logs endpoint'
        });
    }
});

// GET /api/rfid/cards-with-rooms - Ambil kartu dengan ruangan
router.get('/cards-with-rooms', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        rc.id, 
        rc.card_uid, 
        rc.petugas_name, 
        rc.status, 
        rc.registered_at, 
        rc.keterangan,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', dr.id,
              'nama_ruangan', dr.nama_ruangan
            )
          ) FILTER (WHERE dr.id IS NOT NULL), 
          '[]'::json
        ) as ruangan
      FROM rfid_cards rc
      LEFT JOIN rfid_ruangan_relasi rrr ON rc.id = rrr.rfid_card_id
      LEFT JOIN daftar_ruangan dr ON rrr.ruangan_id = dr.id
      GROUP BY rc.id
      ORDER BY rc.registered_at DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error in /cards-with-rooms:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error: ' + error.message 
    });
  }
});

// PUT /api/rfid/cards/:id - Update data kartu dengan ruangan
router.put('/cards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { petugas_name, ruangan, keterangan, status } = req.body;

    // Mulai transaction
    await pool.query('BEGIN');

    // Update data kartu
    const result = await pool.query(
      'UPDATE rfid_cards SET petugas_name = $1, keterangan = $2, status = $3 WHERE id = $4 RETURNING *',
      [petugas_name, keterangan, status, id]
    );

    if (result.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Card not found' });
    }

    // Hapus relasi ruangan lama
    await pool.query('DELETE FROM rfid_ruangan_relasi WHERE rfid_card_id = $1', [id]);

    // Tambah relasi ruangan baru
    if (ruangan && ruangan.length > 0) {
      for (const ruanganId of ruangan) {
        await pool.query(
          'INSERT INTO rfid_ruangan_relasi (rfid_card_id, ruangan_id) VALUES ($1, $2)',
          [id, ruanganId]
        );
      }
    }

    // Commit transaction
    await pool.query('COMMIT');

    res.json({
      success: true,
      message: 'Card updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error updating card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/rfid/card - Untuk pendaftaran kartu dari web
router.post('/card', async (req, res) => {
  let client;
  try {
    const { card_uid, petugas_name, ruangan, keterangan, status } = req.body;
    console.log('Received data:', req.body);

    if (!card_uid) {
      return res.status(400).json({ 
        success: false,
        error: 'Card UID is required' 
      });
    }

    // Dapatkan client dari pool
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Cek apakah kartu sudah ada
    const checkResult = await client.query(
      'SELECT id FROM rfid_cards WHERE card_uid = $1',
      [card_uid]
    );

    if (checkResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        success: false,
        error: 'Card already registered' 
      });
    }

    // 2. Simpan kartu baru (TANPA kolom ruangan)
    const cardResult = await client.query(
      `INSERT INTO rfid_cards (card_uid, petugas_name, keterangan, status) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [card_uid, petugas_name, keterangan, status || 'active']
    );

    const newCard = cardResult.rows[0];
    console.log('New card created:', newCard);

    // 3. Simpan relasi ruangan jika ada
    if (ruangan && ruangan.length > 0 && ruangan[0] !== '') {
      console.log('Saving room relations:', ruangan);
      
      for (const ruanganId of ruangan) {
        if (ruanganId) { // Pastikan bukan empty string
          await client.query(
            `INSERT INTO rfid_ruangan_relasi (rfid_card_id, ruangan_id) 
             VALUES ($1, $2)`,
            [newCard.id, ruanganId]
          );
          console.log(`Saved relation: card ${newCard.id} -> room ${ruanganId}`);
        }
      }
    }

    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      message: 'Card registered successfully',
      data: newCard
    });

  } catch (error) {
    console.error('Error in /card endpoint:', error);
    if (client) await client.query('ROLLBACK');
    res.status(500).json({ 
      success: false,
      error: 'Internal server error: ' + error.message 
    });
  } finally {
    if (client) client.release();
  }
});

// DELETE /api/rfid/cards/:id/ruangan/:ruanganId - Hapus ruangan dari kartu
router.delete('/cards/:id/ruangan/:ruanganId', async (req, res) => {
  try {
    const { id, ruanganId } = req.params;

    const result = await pool.query(
      'DELETE FROM rfid_ruangan_relasi WHERE rfid_card_id = $1 AND ruangan_id = $2 RETURNING *',
      [id, ruanganId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Relasi tidak ditemukan' });
    }

    res.json({
      success: true,
      message: 'Ruangan berhasil dihapus dari kartu',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error removing room from card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/ruangan/petugas - Ambil daftar petugas unik
router.get('/ruangan/petugas', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT petugas_kebersihan FROM daftar_ruangan WHERE petugas_kebersihan IS NOT NULL ORDER BY petugas_kebersihan'
    );

    res.json({
      success: true,
      data: result.rows.map(row => row.petugas_kebersihan)
    });
  } catch (error) {
    console.error('Error fetching petugas:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET ruangan by petugas
router.get('/by-petugas/:petugas', async (req, res) => {
  try {
    const { petugas } = req.params;
    const result = await pool.query(
      'SELECT id, nama_ruangan FROM daftar_ruangan WHERE petugas_kebersihan = $1 ORDER BY nama_ruangan',
      [petugas]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching ruangan by petugas:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});


// GET /api/rfid/logs - QUERY YANG DIPERBAIKI DENGAN SORTING BENAR
router.get('/logs', async (req, res) => {
    try {
        const { search, status, date, room } = req.query;
        
        let query = `
            SELECT 
                rl.*,
                rc.petugas_name as card_petugas_name,
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'id', dr.id,
                            'nama_ruangan', dr.nama_ruangan
                        )
                    ) FILTER (WHERE dr.id IS NOT NULL), 
                    '[]'::json
                ) as ruangan
            FROM rfid_logs rl
            LEFT JOIN rfid_cards rc ON rl.card_uid = rc.card_uid
            LEFT JOIN rfid_ruangan_relasi rrr ON rc.id = rrr.rfid_card_id
            LEFT JOIN daftar_ruangan dr ON rrr.ruangan_id = dr.id
        `;
        
        const conditions = [];
        const params = [];
        let paramCount = 0;
        
        if (search) {
            paramCount++;
            conditions.push(`(rl.petugas_name ILIKE $${paramCount} OR dr.nama_ruangan ILIKE $${paramCount})`);
            params.push(`%${search}%`);
        }
        
        if (status) {
            paramCount++;
            conditions.push(`rl.status = $${paramCount}`);
            params.push(status);
        }
        
        if (date) {
            paramCount++;
            conditions.push(`DATE(rl.waktu) = $${paramCount}`);
            params.push(date);
        }
        
        if (room) {
            paramCount++;
            conditions.push(`dr.nama_ruangan ILIKE $${paramCount}`);
            params.push(`%${room}%`);
        }
        
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        // GROUP BY dan ORDER BY yang benar - urutkan berdasarkan waktu DESC
        query += ` GROUP BY rl.id, rc.id ORDER BY rl.waktu DESC, rl.id DESC`;
        
        const result = await pool.query(query, params);
        
        // TRANSFORM DATA: Pastikan field checklist konsisten
        const transformedData = result.rows.map(row => {
            return {
                ...row,
                // Normalisasi checklist values
                checklist_lantai: row.checklist_lantai,
                checklist_kaca_jendela: row.checklist_kaca_jendela,
                checklist_pintu: row.checklist_pintu,
                checklist_lawa_lawa: row.checklist_lawa_lawa,
                checklist_lubang_angin: row.checklist_lubang_angin,
                checklist_kusen_jendela_dan_pintu: row.checklist_kusen_jendela_dan_pintu,
                checklist_keterangan: row.checklist_keterangan,
                petugas_name: row.petugas_name || row.card_petugas_name
            };
        });
        
        res.json({
            success: true,
            data: transformedData
        });
    } catch (error) {
        console.error('❌ Error fetching logs:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error: ' + error.message 
        });
    }
});

// GET /api/rfid/logs/:id - Ambil detail log
router.get('/logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        rl.*,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', dr.id,
              'nama_ruangan', dr.nama_ruangan
            )
          ) FILTER (WHERE dr.id IS NOT NULL), 
          '[]'::json
        ) as ruangan
      FROM rfid_logs rl
      LEFT JOIN rfid_cards rc ON rl.card_uid = rc.card_uid
      LEFT JOIN rfid_ruangan_relasi rrr ON rc.id = rrr.rfid_card_id
      LEFT JOIN daftar_ruangan dr ON rrr.ruangan_id = dr.id
      WHERE rl.id = $1
      GROUP BY rl.id
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Log tidak ditemukan' 
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching log details:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

/// PUT /api/rfid/logs/:id/checklist - Update checklist dan status
router.put('/logs/:id/checklist', async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            checklist_lantai, 
            checklist_kaca_jendela,
            checklist_pintu, 
            checklist_lawa_lawa, 
            checklist_lubang_angin, 
            checklist_kusen_jendela_dan_pintu,
            checklist_keterangan, 
            status 
        } = req.body;

        console.log('📥 Data checklist yang diterima:', req.body);

        // Pastikan nilai boolean
        const updateData = {
            checklist_lantai: Boolean(checklist_lantai),
            checklist_kaca_jendela: Boolean(checklist_kaca_jendela),
            checklist_pintu: Boolean(checklist_pintu),
            checklist_lawa_lawa: Boolean(checklist_lawa_lawa),
            checklist_lubang_angin: Boolean(checklist_lubang_angin),
            checklist_kusen_jendela_dan_pintu: Boolean(checklist_kusen_jendela_dan_pintu),
            checklist_keterangan: checklist_keterangan || '',
            status: status || 'selesai',
            checklist_at: new Date()
        };

        console.log('🔧 Data checklist setelah konversi:', updateData);

        const result = await pool.query(`
            UPDATE rfid_logs 
            SET 
                checklist_lantai = $1,
                checklist_kaca_jendela = $2,
                checklist_pintu = $3,
                checklist_lawa_lawa = $4,
                checklist_lubang_angin = $5,
                checklist_kusen_jendela_dan_pintu = $6,
                checklist_keterangan = $7,
                status = $8,
                checklist_at = $9
            WHERE id = $10
            RETURNING *
        `, [
            updateData.checklist_lantai,
            updateData.checklist_kaca_jendela,
            updateData.checklist_pintu,
            updateData.checklist_lawa_lawa,
            updateData.checklist_lubang_angin,
            updateData.checklist_kusen_jendela_dan_pintu,
            updateData.checklist_keterangan,
            updateData.status,
            updateData.checklist_at,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Log tidak ditemukan' 
            });
        }

        console.log('✅ Checklist berhasil disimpan:', result.rows[0]);

        res.json({
            success: true,
            message: 'Checklist berhasil disimpan',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('❌ ERROR updating checklist:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error: ' + error.message 
        });
    }
});

// Endpoint untuk memeriksa status kartu
router.get('/check-card', rfidController.checkCard);

// Endpoint untuk mendaftarkan kartu baru
router.post('/card', rfidController.registerCard);

// Endpoint untuk logging akses RFID
router.post('/log', rfidController.logRFID);

/**
 * @route GET /api/rfid/dashboard/summary
 * @desc Get dashboard summary with filters
 * @access Private
 */
router.get('/dashboard/summary', async (req, res) => {
    try {
        const { tanggal, ruangan, petugas } = req.query;
        const dateFilter = tanggal || new Date().toISOString().split('T')[0];
        
        console.log('📊 Dashboard summary request:', { tanggal, ruangan, petugas });
        
        // Query yang lebih sederhana dan robust
        let query = `
            SELECT 
                COUNT(DISTINCT dr.id) as total_ruangan,
                COUNT(DISTINCT dr.petugas_kebersihan) as total_petugas,
                COUNT(DISTINCT CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM rfid_logs rl 
                        JOIN rfid_cards rc ON rl.card_uid = rc.card_uid 
                        JOIN rfid_ruangan_relasi rrr ON rc.id = rrr.rfid_card_id
                        WHERE rrr.ruangan_id = dr.id 
                        AND DATE(rl.waktu) = $1
                        AND rl.status = 'selesai'
                    ) THEN dr.id
                END) as ruangan_bersih,
                COUNT(DISTINCT CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM rfid_logs rl 
                        JOIN rfid_cards rc ON rl.card_uid = rc.card_uid 
                        JOIN rfid_ruangan_relasi rrr ON rc.id = rrr.rfid_card_id
                        WHERE rrr.ruangan_id = dr.id 
                        AND DATE(rl.waktu) = $1
                        AND rl.status = 'tercatat'
                    ) THEN dr.id
                END) as perlu_pembersihan,
                COUNT(DISTINCT CASE 
                    WHEN NOT EXISTS (
                        SELECT 1 FROM rfid_logs rl 
                        JOIN rfid_cards rc ON rl.card_uid = rc.card_uid 
                        JOIN rfid_ruangan_relasi rrr ON rc.id = rrr.rfid_card_id
                        WHERE rrr.ruangan_id = dr.id 
                        AND DATE(rl.waktu) = $1
                    ) THEN dr.id
                END) as belum_dicek
            FROM daftar_ruangan dr
            WHERE dr.petugas_kebersihan IS NOT NULL
        `;
        
        const queryParams = [dateFilter];
        let paramCount = 1;
        
        // Tambahkan filter ruangan
        if (ruangan && ruangan !== '') {
            paramCount++;
            query += ` AND dr.nama_ruangan = $${paramCount}`;
            queryParams.push(ruangan);
        }
        
        // Tambahkan filter petugas
        if (petugas && petugas !== '') {
            paramCount++;
            query += ` AND dr.petugas_kebersihan = $${paramCount}`;
            queryParams.push(petugas);
        }
        
        console.log('🔍 Executing dashboard query:', query);
        console.log('📊 Dashboard query params:', queryParams);
        
        const result = await pool.query(query, queryParams);
        
        console.log('✅ Dashboard query successful:', result.rows[0]);
        
        res.json({
            success: true,
            data: {
                ruangan_bersih: parseInt(result.rows[0].ruangan_bersih) || 0,
                petugas_aktif: parseInt(result.rows[0].total_petugas) || 0,
                perlu_pembersihan: parseInt(result.rows[0].perlu_pembersihan) || 0,
                belum_dicek: parseInt(result.rows[0].belum_dicek) || 0,
                total_ruangan: parseInt(result.rows[0].total_ruangan) || 0
            }
        });
    } catch (error) {
        console.error('❌ Error in dashboard summary endpoint:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: 'Internal server error in dashboard summary endpoint'
        });
    }
});

// GET /api/rfid/ruangan-by-petugas/:petugasName - Ambil ruangan berdasarkan nama petugas
router.get('/ruangan-by-petugas/:petugasName', async (req, res) => {
  try {
    const { petugasName } = req.params;
    
    const result = await pool.query(
      `SELECT DISTINCT dr.nama_ruangan
       FROM rfid_cards rc
       JOIN rfid_ruangan_relasi rrr ON rc.id = rrr.rfid_card_id
       JOIN daftar_ruangan dr ON rrr.ruangan_id = dr.id
       WHERE rc.petugas_name = $1
       ORDER BY dr.nama_ruangan`,
      [petugasName]
    );
    
    res.json({
      success: true,
      data: result.rows.map(row => row.nama_ruangan)
    });
  } catch (error) {
    console.error('Error fetching ruangan by petugas:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});



module.exports = router;