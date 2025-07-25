const { Boom } = require('@hapi/boom');
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { color } = require('./lib/logger');
const { handleCommand } = require('./lib/commands');
const { downloadMedia } = require('./lib/media');
const { createSticker } = require('./lib/sticker');

// Ensure directories exist
if (!fs.existsSync(config.sessionPath)) fs.mkdirSync(config.sessionPath);
if (!fs.existsSync('./downloads')) fs.mkdirSync('./downloads');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: { level: 'silent' }, // We'll use our own logger
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log(color('[QR CODE]', 'yellow'), 'Scan QR code di atas');
        }
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(color('[CONNECTION]', 'red'), `Koneksi terputus, mencoba menghubungkan kembali...`);
            
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log(color('[CONNECTION]', 'green'), 'Bot berhasil terhubung!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Anti Call
    sock.ev.on('call', async (call) => {
        if (config.features.antiCall) {
            const jid = call.from;
            console.log(color('[ANTI CALL]', 'red'), `Memblokir panggilan dari ${jid}`);
            await sock.updateBlockStatus(jid, 'block');
        }
    });

    // Message handler
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        
        const msgType = Object.keys(m.message)[0];
        const sender = m.key.remoteJid;
        const isGroup = sender.endsWith('@g.us');
        const user = isGroup ? m.key.participant : sender;
        const pushName = m.pushName || 'Unknown';
        const msg = m.message[msgType];
        const quotedMsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
        
        // Log message
        console.log(color(`[${isGroup ? 'GROUP' : 'PRIVATE'}]`, 'cyan'), 
            `${pushName} (${user.split('@')[0]}): ${msgType === 'conversation' ? msg : `[${msgType.toUpperCase()}]`}`);
        
        // Auto download media
        if (config.features.autoDownload && ['imageMessage', 'videoMessage', 'audioMessage'].includes(msgType)) {
            await downloadMedia(sock, m);
        }
        
        // Auto sticker
        if (config.features.autoSticker && msgType === 'imageMessage' && msg.caption === '#stiker') {
            await createSticker(sock, m);
            return;
        }
        
        // Auto response
        if (msgType === 'conversation') {
            const text = msg.toLowerCase();
            for (const [keyword, response] of Object.entries(config.autoResponses)) {
                if (text.includes(keyword.toLowerCase())) {
                    await sock.sendMessage(sender, { text: response });
                    return;
                }
            }
        }
        
        // Command handler
        if (msgType === 'conversation' && msg.startsWith(config.prefix)) {
            await handleCommand(sock, m);
        }
    });
}

startBot().catch(err => console.error(color('[ERROR]', 'red'), err));
