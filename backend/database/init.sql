-- Buat tabel users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'supervisor',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert user contoh (password: admin123)
INSERT INTO users (username, password, full_name) 
VALUES ('admin', '$2a$10$rOyZR7AkL6X1qBzZ6Tqk.eJzV8bKXQc6nX6vL6r6X6vL6r6X6vL6', 'Admin Supervisor')
ON CONFLICT (username) DO NOTHING;