// frontend/js/auth-integrated.js
// Integrasi smooth antara sistem auth lama dan baru

class AuthIntegrated {
    constructor() {
        this.tokenKey = 'authToken';
        this.userKey = 'userData';
        this.init();
    }

    init() {
        // Compatibility layer dengan sistem lama
        this.setupCompatibility();
    }

    setupCompatibility() {
        // Buat objek Auth global untuk kompatibilitas dengan kode lama
        window.Auth = {
            // Method dari sistem lama
            isLoggedIn: () => {
                return !!this.getToken() && !!this.getUserData();
            },

            getUser: () => {
                return this.getUserData();
            },

            getUserRole: () => {
                const user = this.getUserData();
                return user ? user.role : null;
            },

            login: (token, userData) => {
                localStorage.setItem(this.tokenKey, token);
                localStorage.setItem(this.userKey, JSON.stringify(userData));
                
                // Set expiration time (24 hours) - untuk kompatibilitas
                const expirationTime = new Date().getTime() + (24 * 60 * 60 * 1000);
                localStorage.setItem('expirationTime', expirationTime);
            },

            logout: () => {
                this.logout();
            },

            isTokenExpired: () => {
                const expirationTime = localStorage.getItem('expirationTime');
                if (!expirationTime) return true;
                return new Date().getTime() > parseInt(expirationTime);
            },

            validateAuth: () => {
                return this.validateSession();
            },

            getToken: () => {
                return this.getToken();
            }
        };

        // Setup auto-check (dari sistem lama)
        setInterval(() => {
            if (!Auth.validateAuth() && !this.isLoginPage()) {
                console.log('Session expired');
            }
        }, 60000);
    }

    // ==================== CORE METHODS ====================
    async login(username, password, role = 'koordinator') {
        try {
            this.showLoading('Sedang masuk...');
            
            const response = await fetch(
                `${window.APP_CONFIG.API_BASE_URL}/api/auth/login`, 
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        username: username, 
                        password: password,
                        role: role
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.token) {
                // Simpan data dengan format kompatibel
                localStorage.setItem(this.tokenKey, data.token);
                localStorage.setItem(this.userKey, JSON.stringify(data.user));
                
                this.hideLoading();
                
                // Redirect ke halaman tujuan
                const redirectUrl = sessionStorage.getItem('redirectAfterLogin') || 'dashboard.html';
                sessionStorage.removeItem('redirectAfterLogin');
                
                window.location.href = redirectUrl;
                return true;
            } else {
                throw new Error(data.error || 'Login gagal');
            }
        } catch (error) {
            this.hideLoading();
            console.error('Login error:', error);
            throw error; // Biarkan error ditangani oleh kode existing
        }
    }

    logout() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        localStorage.removeItem('expirationTime');
        sessionStorage.removeItem('redirectAfterLogin');
        window.location.href = 'index.html';
    }

    // ==================== VALIDATION METHODS ====================
    async validateSession() {
        const token = this.getToken();
        const userData = this.getUserData();

        // Jika di halaman login, skip validasi
        if (this.isLoginPage()) {
            // Jika sudah login tapi ada di halaman login, redirect ke dashboard
            if (token && userData) {
                window.location.href = 'dashboard.html';
            }
            return true;
        }

        // Jika tidak ada token, redirect ke login
        if (!token || !userData) {
            this.redirectToLogin();
            return false;
        }

        return true; // Untuk sekarang, skip backend validation dulu
    }

    // ==================== UTILITY METHODS ====================
    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    getUserData() {
        const userData = localStorage.getItem(this.userKey);
        return userData ? JSON.parse(userData) : null;
    }

    isLoginPage() {
        const currentPage = window.location.pathname.split('/').pop();
        return ['index.html', 'login.html', 'login-pj.html'].includes(currentPage);
    }

    redirectToLogin() {
        if (!this.isLoginPage()) {
            sessionStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = 'index.html';
        }
    }

    // ==================== UI METHODS ====================
    showLoading(message = 'Memverifikasi...') {
        this.hideLoading();
        
        const overlay = document.createElement('div');
        overlay.id = 'auth-loading-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.95);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            flex-direction: column;
        `;

        overlay.innerHTML = `
            <div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite;"></div>
            <p style="margin-top: 15px; font-family: Arial; color: #333;">${message}</p>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        document.body.appendChild(overlay);
    }

    hideLoading() {
        const existingOverlay = document.getElementById('auth-loading-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
    }
}

// ==================== GLOBAL INITIALIZATION ====================
window.AuthManager = new AuthIntegrated();

// Auto-validate pada page load untuk halaman yang dilindungi
document.addEventListener('DOMContentLoaded', function() {
    if (!AuthManager.isLoginPage()) {
        AuthManager.validateSession();
    }
});