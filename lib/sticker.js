const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { color } = require('./logger');

async function createSticker(sock, m) {
    const sender = m.key.remoteJid;
    
    try {
        // Download the image
        const buffer = await sock.downloadMediaMessage(m);
        const inputPath = path.join('downloads', `sticker_temp_${Date.now()}.jpg`);
        const outputPath = path.join('downloads', `sticker_${Date.now()}.webp`);
        
        fs.writeFileSync(inputPath, buffer);
        
        // Convert to webp using ffmpeg
        exec(`ffmpeg -i ${inputPath} -vf scale=512:512 ${outputPath}`, async (error) => {
            if (error) {
                console.error(color('[STICKER ERROR]', 'red'), error);
                await sock.sendMessage(sender, { text: 'Gagal membuat stiker' });
                return;
            }
            
            // Send the sticker
            const stickerBuffer = fs.readFileSync(outputPath);
            await sock.sendMessage(sender, { 
                sticker: stickerBuffer 
            }, { quoted: m });
            
            // Clean up
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
            
            console.log(color('[STICKER]', 'green'), 'Stiker berhasil dibuat');
        });
    } catch (err) {
        console.error(color('[STICKER ERROR]', 'red'), err);
        await sock.sendMessage(sender, { text: 'Gagal membuat stiker' });
    }
}

module.exports = { createSticker };
