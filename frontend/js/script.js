document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const messageDiv = document.getElementById('message');
    
    try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            messageDiv.textContent = 'Login berhasil!';
            messageDiv.className = 'message success';
            
            // Simpan token dan data user (untuk penggunaan selanjutnya)
            localStorage.setItem('token', data.data.token);
            localStorage.setItem('user', JSON.stringify(data.data.user));
            
            // Redirect ke halaman dashboard (akan dibuat kemudian)
            setTimeout(() => {
                alert('Login berhasil! Akan dialihkan ke dashboard.');
                // window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            messageDiv.textContent = data.message;
            messageDiv.className = 'message error';
        }
    } catch (error) {
        messageDiv.textContent = 'Terjadi kesalahan. Pastikan backend berjalan.';
        messageDiv.className = 'message error';
        console.error('Error:', error);
    }
});