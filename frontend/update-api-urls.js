// update-api-urls.js - Script untuk replace semua localhost dengan config
const fs = require('fs');
const path = require('path');

const frontendPath = './frontend'; // Path ke folder frontend

function updateFiles(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            updateFiles(filePath);
        } else if (file.endsWith('.html') || file.endsWith('.js')) {
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Replace hardcoded localhost URLs dengan config
            content = content.replace(
                /fetch\s*\(\s*['"`]http:\/\/localhost:3000\/api/g,
                'fetch(`${window.APP_CONFIG.API_BASE_URL}/api'
            );
            
            content = content.replace(
                /['"`]http:\/\/localhost:3000\/api\/[^'"]*['"`]/g,
                '`${window.APP_CONFIG.API_BASE_URL}/api/your-endpoint`'
            );
            
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Updated: ${filePath}`);
        }
    });
}

updateFiles(frontendPath);
console.log('🎉 All files updated!');