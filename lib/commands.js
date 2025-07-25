const config = require('../config');
const { color } = require('./logger');

async function handleCommand(sock, m) {
    const sender = m.key.remoteJid;
    const isGroup = sender.endsWith('@g.us');
    const user = isGroup ? m.key.participant : sender;
    const msg = m.message.conversation;
    const args = msg.slice(config.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    console.log(color('[COMMAND]', 'magenta'), `${command} executed by ${user.split('@')[0]}`);
    
    switch(command) {
        case 'ping':
            await sock.sendMessage(sender, { text: 'Bot aktif!' });
            break;
            
        case 'menu':
            const menuText = `*Bot Menu*\n\n` +
                `${config.prefix}ping - Cek bot aktif\n` +
                `${config.prefix}menu - Tampilkan menu\n` +
                `${config.prefix}owner - Info owner\n` +
                `${config.prefix}send <nomor|pesan> - Kirim pesan ke nomor tertentu\n` +
                `\nFitur lain:\n` +
                `- Balas gambar dengan caption #stiker untuk membuat stiker\n` +
                `- Auto download media`;
            await sock.sendMessage(sender, { text: menuText });
            break;
            
        case 'owner':
            await sock.sendMessage(sender, { 
                text: `*Owner Bot*\nNama: ${config.owner.name}\nNomor: ${config.owner.number}` 
            });
            break;
            
        case 'send':
            if (args.length < 2) {
                await sock.sendMessage(sender, { text: 'Format salah! Gunakan: !send 62xxxx|pesan' });
                return;
            }
            
            const [number, ...messageParts] = args.join(' ').split('|');
            const message = messageParts.join('|');
            
            if (!number || !message) {
                await sock.sendMessage(sender, { text: 'Format salah! Gunakan: !send 62xxxx|pesan' });
                return;
            }
            
            try {
                const jid = `${number}@s.whatsapp.net`;
                await sock.sendMessage(jid, { text: message });
                await sock.sendMessage(sender, { text: `Pesan terkirim ke ${number}` });
            } catch (err) {
                await sock.sendMessage(sender, { text: `Gagal mengirim pesan: ${err.message}` });
            }
            break;
            
        default:
            await sock.sendMessage(sender, { text: 'Perintah tidak dikenali. Ketik !menu untuk melihat daftar perintah' });
    }
}

module.exports = { handleCommand };
