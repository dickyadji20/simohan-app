document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const userInfoElement = document.getElementById('userInfo');
    const logoutBtn = document.getElementById('logoutBtn');
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');
    const loadingOverlay = document.getElementById('loadingOverlay');

    // API Base URL
    const API_BASE_URL = 'http://localhost:3000';

    // Check authentication on page load
    checkAuthentication();

    // Event Listeners
    logoutBtn.addEventListener('click', handleLogout);
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.querySelector('a').dataset.section;
            switchSection(section);
        });
    });

    // Functions
    function checkAuthentication() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        console.log('Token from storage:', token ? 'Exists' : 'Missing');
        console.log('User from storage:', user);

        if (!token) {
            console.log('No token found, redirecting to login');
            redirectToLogin();
            return;
        }

        showLoading();
        
        // Verify token with backend
        verifyToken(token)
            .then(response => {
                console.log('Token verification successful:', response);
                hideLoading();
                displayUserInfo(user);
                loadDashboardData();
            })
            .catch(error => {
                console.error('Token verification failed:', error);
                hideLoading();
                alert('Session expired. Please login again.');
                redirectToLogin();
            });
    }

    function verifyToken(token) {
        return new Promise((resolve, reject) => {
            fetch(`${API_BASE_URL}/api/auth/verify`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    resolve(data);
                } else {
                    reject(new Error(data.message || 'Token verification failed'));
                }
            })
            .catch(error => {
                console.error('Error verifying token:', error);
                reject(error);
            });
        });
    }

    function displayUserInfo(user) {
        if (user && user.nama) {
            userInfoElement.textContent = `Selamat datang, ${user.nama} (${user.role})`;
        } else {
            userInfoElement.textContent = 'Selamat datang, Pengguna';
        }
    }

    // FUNCTION SWITCHSECTION YANG DIMODIFIKASI
    function switchSection(sectionName) {
    // Update active nav item
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.querySelector('a').dataset.section === sectionName) {
            item.classList.add('active');
        }
    });

    // Show corresponding content section
    contentSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === `${sectionName}Content`) {
            section.classList.add('active');
        }
    });

    // Update content title
    const contentTitle = document.getElementById('contentTitle');
    const contentSubtitle = document.getElementById('contentSubtitle');
    
    switch(sectionName) {
        case 'dashboard':
            contentTitle.textContent = 'Dashboard';
            contentSubtitle.textContent = 'Ringkasan monitoring kebersihan';
            loadDashboardData();
            break;
        case 'monitoring':
            contentTitle.textContent = 'Monitoring';
            contentSubtitle.textContent = 'Pantau kebersihan ruangan';
            break;
        case 'laporan':
            contentTitle.textContent = 'Laporan Kebersihan';
            contentSubtitle.textContent = 'Manajemen monitoring kebersihan ruangan';
            // Inisialisasi laporan manager
            if (typeof initLaporanSection === 'function') {
                initLaporanSection();
            } else if (typeof window.laporanManager !== 'undefined') {
                window.laporanManager.init();
            }
            break;
        case 'pengaturan':
            contentTitle.textContent = 'Pengaturan';
            contentSubtitle.textContent = 'Kelola pengaturan akun';
            break;
    }
}

    function loadDashboardData() {
        showLoading();
        
        // Simulate API call
        setTimeout(() => {
            const stats = {
                clean: Math.floor(Math.random() * 20) + 10,
                needCleaning: Math.floor(Math.random() * 10) + 1,
                notChecked: Math.floor(Math.random() * 5) + 1,
                activeStaff: Math.floor(Math.random() * 8) + 5
            };

            updateStats(stats);
            hideLoading();
        }, 1500);
    }

    function updateStats(stats) {
        const statNumbers = document.querySelectorAll('.stat-number');
        if (statNumbers.length >= 4) {
            statNumbers[0].textContent = stats.clean;
            statNumbers[1].textContent = stats.needCleaning;
            statNumbers[2].textContent = stats.notChecked;
            statNumbers[3].textContent = stats.activeStaff;
        }
    }

    function handleLogout() {
        showLoading();
        
        // Clear local storage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Redirect to login page
        setTimeout(() => {
            hideLoading();
            window.location.href = 'index.html';
        }, 500);
    }

    function redirectToLogin() {
        // Clear invalid token
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }

    function showLoading() {
        loadingOverlay.style.display = 'flex';
    }

    function hideLoading() {
        loadingOverlay.style.display = 'none';
    }

    // Initialize dashboard
    switchSection('dashboard');
});