const { Boom } = require('@hapi/boom');
const { 
    makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    delay 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { color } = require('./lib/logger');
const { handleCommand } = require('./lib/commands');
const { downloadMedia } = require('./lib/media');
const { createSticker } = require('./lib/sticker');

// Ensure directories exist
if (!fs.existsSync(config.sessionPath)) fs.mkdirSync(config.sessionPath, { recursive: true });
if (!fs.existsSync('./downloads')) fs.mkdirSync('./downloads', { recursive: true });

// Custom logger with colors
const logger = pino({
    level: 'silent', // Disable Baileys internal logs (we handle our own)
    transport: {
        target: 'pino-pretty',
        options: { colorize: true }
    }
});

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionPath);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(color(`[BAILEYS]`, 'magenta'), `Using version ${version} (latest: ${isLatest})`);

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: logger,
        browser: ['Thon-Bot', 'Safari', '1.0.0'], // Custom browser info
        getMessage: async (key) => {
            // Optional: Implement message retry handling
            return null;
        }
    });

    // Handle connection updates (QR, reconnects, etc.)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log(color('[QR CODE]', 'yellow'), 'Scan this QR code to log in:');
            // You can also generate a QR terminal here if needed
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(color('[CONNECTION]', 'red'), `Disconnected, reconnecting... (Reason: ${DisconnectReason[lastDisconnect.error?.output?.statusCode] || 'unknown'})`);

            if (shouldReconnect) {
                setTimeout(startBot, 5000); // Reconnect after 5 seconds
            }
        } else if (connection === 'open') {
            console.log(color('[CONNECTION]', 'green'), 'Bot successfully connected!');
            console.log(color('[BOT]', 'cyan'), `Logged in as: ${sock.user?.name || 'Unknown'}`);
        }
    });

    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);

    // Anti-call feature
    sock.ev.on('call', async (call) => {
        if (config.features.antiCall) {
            const jid = call.from;
            console.log(color('[ANTI CALL]', 'red'), `Blocking call from ${jid}`);
            await sock.updateBlockStatus(jid, 'block');
            await sock.sendMessage(jid, { text: 'Calls are blocked by this bot.' });
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
        console.log(
            color(`[${isGroup ? 'GROUP' : 'PRIVATE'}]`, 'cyan'),
            `${pushName} (${user.split('@')[0]}): ${msgType === 'conversation' ? msg : `[${msgType.toUpperCase()}]`}`
        );

        // Auto-download media (images, videos, audio)
        if (config.features.autoDownload && ['imageMessage', 'videoMessage', 'audioMessage'].includes(msgType)) {
            try {
                await downloadMedia(sock, m);
                console.log(color('[MEDIA]', 'blue'), 'Media downloaded successfully');
            } catch (err) {
                console.error(color('[ERROR]', 'red'), 'Failed to download media:', err);
            }
        }

        // Auto-sticker (if caption is #sticker)
        if (config.features.autoSticker && msgType === 'imageMessage' && msg.caption === '#sticker') {
            try {
                await createSticker(sock, m);
                console.log(color('[STICKER]', 'green'), 'Sticker created successfully');
            } catch (err) {
                console.error(color('[ERROR]', 'red'), 'Failed to create sticker:', err);
            }
            return;
        }

        // Auto-response (from config.autoResponses)
        if (msgType === 'conversation') {
            const text = msg.toLowerCase();
            for (const [keyword, response] of Object.entries(config.autoResponses)) {
                if (text.includes(keyword.toLowerCase())) {
                    await sock.sendMessage(sender, { text: response });
                    return;
                }
            }
        }

        // Command handler (if message starts with prefix)
        if (msgType === 'conversation' && msg.startsWith(config.prefix)) {
            try {
                await handleCommand(sock, m);
            } catch (err) {
                console.error(color('[ERROR]', 'red'), 'Command error:', err);
                await sock.sendMessage(sender, { text: '⚠️ An error occurred while processing your command.' });
            }
        }
    });
}

// Start bot with auto-restart on crash
(async () => {
    while (true) {
        try {
            await startBot();
        } catch (err) {
            console.error(color('[FATAL ERROR]', 'red'), err);
            await delay(5000); // Wait 5 seconds before restarting
        }
    }
})();
