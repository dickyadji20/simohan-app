class LaporanManager {
    constructor() {
        this.API_BASE_URL = 'http://localhost:3000';
        this.ruanganList = [];
        this.monitoringData = [];
        this.isInitialized = false;
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        await this.loadRuangan();
        this.setupEventListeners();
        await this.loadData();
        this.isInitialized = true;
        
        console.log('LaporanManager initialized successfully');
    }

    async loadRuangan() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                this.showError('Token tidak ditemukan. Silakan login ulang.');
                return;
            }

            const response = await fetch(`${this.API_BASE_URL}/api/laporan/ruangan`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.ruanganList = data.data;
                this.populateRuanganDropdowns();
            } else {
                console.error('Failed to load ruangan:', response.status);
                this.showError('Gagal memuat data ruangan');
            }
        } catch (error) {
            console.error('Error loading ruangan:', error);
            this.showError('Gagal memuat data ruangan');
        }
    }

    populateRuanganDropdowns() {
        const filterDropdown = document.getElementById('filterRuangan');
        const inputDropdown = document.getElementById('inputRuangan');

        if (!filterDropdown || !inputDropdown) {
            console.error('Dropdown elements not found');
            return;
        }

        // Clear existing options
        filterDropdown.innerHTML = '<option value="">Semua Ruangan</option>';
        inputDropdown.innerHTML = '<option value="">Pilih Ruangan</option>';

        // Add ruangan options
        this.ruanganList.forEach(ruangan => {
            const option = document.createElement('option');
            option.value = ruangan.id;
            option.textContent = `${ruangan.nama_ruangan} (Lt. ${ruangan.lantai})`;

            filterDropdown.appendChild(option.cloneNode(true));
            inputDropdown.appendChild(option);
        });
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Pastikan elemen ada sebelum menambahkan event listener
        const btnFilter = document.getElementById('btnFilter');
        const btnTambah = document.getElementById('btnTambah');
        const modalClose = document.querySelector('.modal-close');
        const btnBatal = document.getElementById('btnBatal');
        const formMonitoring = document.getElementById('formMonitoring');

        if (btnFilter) {
            btnFilter.addEventListener('click', () => {
                this.loadData();
            });
        }

        if (btnTambah) {
            btnTambah.addEventListener('click', () => {
                this.showModal();
            });
        }

        if (modalClose) {
            modalClose.addEventListener('click', () => {
                this.hideModal();
            });
        }

        if (btnBatal) {
            btnBatal.addEventListener('click', () => {
                this.hideModal();
            });
        }

        if (formMonitoring) {
            // Hapus event listener lama jika ada
            formMonitoring.replaceWith(formMonitoring.cloneNode(true));
            
            // Tambahkan event listener baru
            document.getElementById('formMonitoring').addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveData();
            });
        }

        // Close modal when clicking outside
        const modal = document.getElementById('modalMonitoring');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'modalMonitoring') {
                    this.hideModal();
                }
            });
        }

        console.log('Event listeners setup completed');
    }

    async loadData() {
        try {
            this.showLoading();
            const token = localStorage.getItem('token');
            if (!token) {
                this.showError('Token tidak ditemukan. Silakan login ulang.');
                return;
            }

            const tanggal = document.getElementById('filterTanggal')?.value || '';
            const ruanganId = document.getElementById('filterRuangan')?.value || '';

            let url = `${this.API_BASE_URL}/api/laporan/monitoring`;
            const params = new URLSearchParams();

            if (tanggal) params.append('tanggal', tanggal);
            if (ruanganId) params.append('ruangan_id', ruanganId);

            if (params.toString()) {
                url += '?' + params.toString();
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.monitoringData = data.data;
                this.renderTable(this.monitoringData);
            } else {
                this.showError('Gagal memuat data');
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Terjadi kesalahan saat memuat data');
        } finally {
            this.hideLoading();
        }
    }

    renderTable(data) {
        const tbody = document.querySelector('#tabelLaporan tbody');
        if (!tbody) {
            console.error('Tabel body not found');
            return;
        }

        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: #6c757d;">
                        <i>Tidak ada data monitoring untuk filter yang dipilih</i>
                    </td>
                </tr>
            `;
            return;
        }

        data.forEach(item => {
            const row = document.createElement('tr');
            
            let statusClass = '';
            let statusIcon = '';
            switch(item.status_kebersihan) {
                case 'Bersih':
                    statusClass = 'status-bersih';
                    statusIcon = '✅';
                    break;
                case 'Kotor':
                    statusClass = 'status-kotor';
                    statusIcon = '❌';
                    break;
                case 'Perlu Perbaikan':
                    statusClass = 'status-perbaikan';
                    statusIcon = '⚠️';
                    break;
            }

            const tanggal = new Date(item.tanggal);
            const formattedDate = tanggal.toLocaleDateString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            const waktu = item.waktu.substring(0, 5);

            row.innerHTML = `
                <td>
                    <div><strong>${formattedDate}</strong></div>
                    <div style="font-size: 0.8em; color: #6c757d;">${waktu}</div>
                </td>
                <td>${item.nama_ruangan}</td>
                <td>Lantai ${item.lantai}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${statusIcon} ${item.status_kebersihan}
                    </span>
                </td>
                <td>${item.nama_petugas}</td>
                <td>${item.catatan || '<i>Tidak ada catatan</i>'}</td>
                <td>
                    <button class="btn-danger" data-id="${item.id}" title="Hapus Data">
                        🗑️ Hapus
                    </button>
                </td>
            `;

            tbody.appendChild(row);
        });

        // Tambahkan event listener untuk tombol hapus
        this.attachDeleteListeners();
    }

    attachDeleteListeners() {
        const deleteButtons = document.querySelectorAll('.btn-danger');
        deleteButtons.forEach(button => {
            // Hapus event listener lama
            button.replaceWith(button.cloneNode(true));
            
            // Tambahkan event listener baru
            button.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                if (id) {
                    this.hapusData(parseInt(id));
                }
            });
        });
    }

    async hapusData(id) {
        if (!confirm('Apakah Anda yakin ingin menghapus data monitoring ini?\nData yang dihapus tidak dapat dikembalikan.')) {
            return;
        }

        try {
            this.showLoading();
            const token = localStorage.getItem('token');
            const response = await fetch(`${this.API_BASE_URL}/api/laporan/monitoring/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showSuccess('Data berhasil dihapus');
                await this.loadData();
            } else {
                this.showError(result.message || 'Gagal menghapus data');
            }
        } catch (error) {
            console.error('Error deleting data:', error);
            this.showError('Terjadi kesalahan saat menghapus data');
        } finally {
            this.hideLoading();
        }
    }

    showModal() {
        const modal = document.getElementById('modalMonitoring');
        if (modal) {
            modal.style.display = 'block';
            this.resetForm();
        }
    }

    hideModal() {
        const modal = document.getElementById('modalMonitoring');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    resetForm() {
        const form = document.getElementById('formMonitoring');
        if (form) {
            form.reset();
            // Set nilai default
            const today = new Date();
            document.getElementById('inputTanggal').value = today.toISOString().split('T')[0];
            document.getElementById('inputWaktu').value = today.toTimeString().substring(0, 5);
        }
    }

    async saveData() {
        try {
            this.showLoading();
            const token = localStorage.getItem('token');
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            
            const formData = {
                ruangan_id: document.getElementById('inputRuangan').value,
                petugas_id: user.id,
                tanggal: document.getElementById('inputTanggal').value,
                waktu: document.getElementById('inputWaktu').value,
                status_kebersihan: document.getElementById('inputStatus').value,
                catatan: document.getElementById('inputCatatan').value
            };

            // Validasi
            if (!formData.ruangan_id || !formData.tanggal || !formData.waktu || !formData.status_kebersihan) {
                this.showError('Harap isi semua field yang wajib diisi');
                this.hideLoading();
                return;
            }

            const response = await fetch(`${this.API_BASE_URL}/api/laporan/monitoring`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showSuccess('Data monitoring berhasil disimpan');
                this.hideModal();
                await this.loadData(); // Reload data setelah penyimpanan
            } else {
                this.showError(result.message || 'Gagal menyimpan data');
            }
        } catch (error) {
            console.error('Error saving data:', error);
            this.showError('Terjadi kesalahan saat menyimpan data');
        } finally {
            this.hideLoading();
        }
    }

    showLoading() {
        const tbody = document.querySelector('#tabelLaporan tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem;">
                        <div class="loading-spinner" style="margin: 0 auto;"></div>
                        <div style="margin-top: 1rem; color: #6c757d;">Memuat data...</div>
                    </td>
                </tr>
            `;
        }
    }

    hideLoading() {
        // Loading dihandle oleh renderTable
    }

    showSuccess(message) {
        // Buat notifikasi custom yang lebih baik
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #d4edda;
            color: #155724;
            padding: 1rem;
            border-radius: 5px;
            border: 1px solid #c3e6cb;
            z-index: 10000;
            max-width: 300px;
        `;
        notification.innerHTML = `✅ ${message}`;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 3000);
    }

    showError(message) {
        // Buat notifikasi error
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f8d7da;
            color: #721c24;
            padding: 1rem;
            border-radius: 5px;
            border: 1px solid #f5c6cb;
            z-index: 10000;
            max-width: 300px;
        `;
        notification.innerHTML = `❌ ${message}`;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 3000);
    }
}

// Inisialisasi ketika halaman dimuat
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded, initializing LaporanManager...');
    
    // Tunggu sedikit untuk memastikan semua elemen sudah render
    setTimeout(() => {
        if (typeof window.laporanManager === 'undefined') {
            window.laporanManager = new LaporanManager();
        } else {
            console.log('LaporanManager already exists, reinitializing...');
            window.laporanManager.init();
        }
    }, 500);
});

// Juga inisialisasi ketika section laporan diakses
function initLaporanSection() {
    if (typeof window.laporanManager === 'undefined') {
        window.laporanManager = new LaporanManager();
    } else {
        window.laporanManager.init();
    }
}