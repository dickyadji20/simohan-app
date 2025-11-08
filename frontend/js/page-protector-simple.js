(function() {
    'use strict';
    
    const currentPage = window.location.pathname.split('/').pop();
    const publicPages = ['index.html', 'login.html', 'login-pj.html', 'petugas.html', 'pengguna.html'];
    
    // Jika halaman ini tidak perlu protection, skip
    if (publicPages.includes(currentPage)) {
        return;
    }
    
    // Cek authentication sederhana
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    
    if (!token || !userData) {
        // Simpan URL saat ini untuk redirect setelah login
        sessionStorage.setItem('redirectAfterLogin', window.location.href);
        window.location.href = 'index.html';
    }
})();