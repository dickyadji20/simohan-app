    document.getElementById('laporanForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = {
            nama: document.getElementById('nama').value,
            ruangan: document.getElementById('ruangan').value,
            status: document.getElementById('status').value,
            catatan: document.getElementById('catatan').value
        };
        fetch('/api/cleaning', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => response.json())
        .then(data => {
            alert('Laporan berhasil dikirim');
            document.getElementById('laporanForm').reset();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Terjadi kesalahan');
        });
    });