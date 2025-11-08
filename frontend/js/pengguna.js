    document.getElementById('kebutuhanForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = {
            nama: document.getElementById('nama').value,
            ruangan: document.getElementById('ruangan').value,
            kebutuhan: document.getElementById('kebutuhan').value
        };
        fetch('/api/laporan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => response.json())
        .then(data => {
            alert('Laporan berhasil dikirim');
            document.getElementById('kebutuhanForm').reset();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Terjadi kesalahan');
        });
    });