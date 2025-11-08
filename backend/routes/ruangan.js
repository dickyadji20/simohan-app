const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET semua data ruangan
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM daftar_ruangan ORDER BY nama_ruangan');
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching ruangan:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET data ruangan berdasarkan ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM daftar_ruangan WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ruangan tidak ditemukan'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching ruangan by ID:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST tambah data ruangan baru
router.post('/', async (req, res) => {
  try {
    const { nama_ruangan, petugas_kebersihan, penanggung_jawab, koordinator_kebersihan } = req.body;
    
    // Validasi input
    if (!nama_ruangan) {
      return res.status(400).json({
        success: false,
        error: 'Nama Ruangan wajib diisi'
      });
    }
    
    // Insert data baru
    const result = await pool.query(
      'INSERT INTO daftar_ruangan (nama_ruangan, petugas_kebersihan, penanggung_jawab, koordinator_kebersihan) VALUES ($1, $2, $3, $4) RETURNING *',
      [nama_ruangan, petugas_kebersihan, penanggung_jawab, koordinator_kebersihan]
    );
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Ruangan berhasil ditambahkan'
    });
  } catch (error) {
    console.error('Error adding ruangan:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// PUT update data ruangan
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nama_ruangan, petugas_kebersihan, penanggung_jawab, koordinator_kebersihan } = req.body;
    
    // Validasi input
    if (!nama_ruangan) {
      return res.status(400).json({
        success: false,
        error: 'Nama Ruangan wajib diisi'
      });
    }
    
    // Update data
    const result = await pool.query(
      'UPDATE daftar_ruangan SET nama_ruangan = $1, petugas_kebersihan = $2, penanggung_jawab = $3, koordinator_kebersihan = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [nama_ruangan, petugas_kebersihan, penanggung_jawab, koordinator_kebersihan, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ruangan tidak ditemukan'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Ruangan berhasil diperbarui'
    });
  } catch (error) {
    console.error('Error updating ruangan:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// DELETE hapus data ruangan
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM daftar_ruangan WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ruangan tidak ditemukan'
      });
    }
    
    res.json({
      success: true,
      message: 'Ruangan berhasil dihapus'
    });
  } catch (error) {
    console.error('Error deleting ruangan:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET daftar petugas unik dari tabel daftar_ruangan
router.get('/petugas/list', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT petugas_kebersihan as nama 
      FROM daftar_ruangan 
      WHERE petugas_kebersihan IS NOT NULL AND petugas_kebersihan != ''
      ORDER BY petugas_kebersihan
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching petugas list:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
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


module.exports = router;