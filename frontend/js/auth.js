
//assets/js/auth.js

const Auth = {
  // Check if user is logged in
  isLoggedIn: () => {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    return !!(token && userData);
  },

  // Get user data
  getUser: () => {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  },

  // Get user role
  getUserRole: () => {
    const user = Auth.getUser();
    return user ? user.role : null;
  },

  // Save login data
  login: (token, userData) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('userData', JSON.stringify(userData));
    
    // Set expiration time (24 hours)
    const expirationTime = new Date().getTime() + (24 * 60 * 60 * 1000);
    localStorage.setItem('expirationTime', expirationTime);
  },

  // Logout
  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('expirationTime');
    window.location.href = 'login.html';
  },

  // Check if token is expired
  isTokenExpired: () => {
    const expirationTime = localStorage.getItem('expirationTime');
    if (!expirationTime) return true;
    
    return new Date().getTime() > parseInt(expirationTime);
  },

  // Validate authentication on page load
  validateAuth: () => {
    if (!Auth.isLoggedIn() || Auth.isTokenExpired()) {
      Auth.logout();
      return false;
    }
    return true;
  },

  // Get auth token for API requests
  getToken: () => {
    return localStorage.getItem('authToken');
  }
};

// Auto-check authentication every minute
setInterval(() => {
  if (!Auth.validateAuth() && !window.location.pathname.endsWith('login.html')) {
    alert('Session telah berakhir. Silakan login kembali.');
  }
}, 60000);


// Fungsi untuk mengecek status login

// Fungsi untuk logout
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    window.location.href = 'login.html';
}

// Fungsi untuk mendapatkan token
function getToken() {
    return localStorage.getItem('authToken');
}

// Fungsi untuk mendapatkan data user
function getUserData() {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
}


// Handle browser back/forward buttons
window.addEventListener('popstate', function() {
    if (!checkAuth() && !window.location.pathname.endsWith('login.html')) {
        window.location.href = 'login.html';
    }
});

// Export fungsi untuk digunakan di file lain
window.Auth = {
    checkAuth,
    logout,
    getToken,
    getUserData
};


// ========== TAMBAHKAN FUNGSI INI DI BAWAH ==========
// Auto-redirect protection untuk halaman yang perlu login
function checkAuth() {
    // Daftar halaman yang BOLEH diakses tanpa login
    const publicPages = [
        'index.html', 
        'login.html', 
        'login-pj.html', 
        'petugas.html', 
        'pengguna.html',
        '404.html'
    ];
    
    // Dapatkan nama halaman saat ini
    const currentPage = window.location.pathname.split('/').pop();
    
    // Jika halaman ini public, skip protection
    if (publicPages.includes(currentPage)) {
        return true;
    }
    
    // Cek apakah user sudah login
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    
    // Jika BELUM login, redirect ke login.html
    if (!token || !userData) {
        window.location.href = 'login.html';
        return false;
    }
    
    return true;
}

// Jalankan pengecekan saat halaman dimuat
document.addEventListener('DOMContentLoaded', function() {
    // Tunggu sebentar untuk memastikan semua resource loaded
    setTimeout(checkAuth, 100);
});



// Juga jalankan ketika URL berubah (untuk navigasi)
window.addEventListener('popstate', checkAuth);

// Make Auth global
window.Auth = Auth;
