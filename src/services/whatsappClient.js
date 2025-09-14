const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const { CHROME_PATH } = require('../config/env');

let chromeLauncher = null;

// Ignore Puppeteer EBUSY/lockfile errors on Windows
process.on("uncaughtException", (err) => {
    if (
        err.message.includes("EBUSY: resource busy or locked, unlink") ||
        err.message.includes("lockfile") ||
        err.message.includes("Session closed") ||
        err.message.includes("Protocol error")
    ) {
        console.warn("⚠️ Ignored Puppeteer/lockfile error:", err.message);
        return;
    }
    throw err;
});

function loadChromeLauncher() {
    if (chromeLauncher) return chromeLauncher;
    try {
        chromeLauncher = require('chrome-launcher');
        return chromeLauncher;
    } catch (err) {
        console.warn("[Chrome Detection] chrome-launcher not available, skipping:", err.message);
        return null;
    }
}

function detectChromePath() {
    if (CHROME_PATH) return CHROME_PATH;

    try {
        const launcher = loadChromeLauncher();
        if (launcher?.Launcher?.getInstallations) {
            const installs = launcher.Launcher.getInstallations();
            if (installs && installs.length) return installs[0];
        }
    } catch (err) {
        console.warn('[Chrome Detection] Error detecting Chrome:', err.message);
    }

    return undefined; // Puppeteer decides
}

// Keep the same object reference for each user
const clients = {}; // userId => { client, isReady, lastQr, lastQrTime, loggedInUser }

// Initialize WhatsApp client for a specific user
async function init(userId) {
    if (!userId) throw new Error('userId is required');

    if (clients[userId]?.client) return clients[userId].client;

    const executablePath = detectChromePath();

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: userId }),
        puppeteer: {
            headless: true,
            executablePath,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions', '--disable-gpu']
        }
    });

    // Store the client reference
    clients[userId] = {
        client,
        isReady: false,
        lastQr: null,
        lastQrTime: null,
        loggedInUser: null
    };

    client.on('qr', (qr) => {
        const u = clients[userId];
        u.lastQr = qr;
        u.lastQrTime = new Date().toISOString();
        u.isReady = false;
        console.log(`[${userId}] QR generated`);
    });

    client.on('ready', () => {
        const u = clients[userId];
        u.isReady = true;
        u.lastQr = null;
        u.lastQrTime = null;
        u.loggedInUser = {
            number: client.info.wid._serialized,
            name: client.info.pushname || null,
            phoneNumber: client.info.me.user || null
        };
        console.log(`[${userId}] WhatsApp ready`, u.loggedInUser);
    });

    client.on('auth_failure', (msg) => {
        clients[userId].isReady = false;
        console.error(`[${userId}] Auth failure:`, msg);
    });

    client.on('disconnected', (reason) => {
        clients[userId].isReady = false;
        console.warn(`[${userId}] Client disconnected: ${reason}`);
    });

    await client.initialize();
    return client;
}

// Always return the latest status object
function getStatus(userId) {
    const u = clients[userId];
    if (!u) return null;
    return {
        isReady: u.isReady,
        lastQr: u.lastQr,
        lastQrTime: u.lastQrTime,
        loggedInUser: u.loggedInUser
    };
}

function getClient(userId) {
    const u = clients[userId];
    if (!u || !u.client) throw new Error(`No client found for user ${userId}`);
    return u.client;
}

// Logout and remove session
async function logout(userId) {
    const u = clients[userId];
    const sessionPath = path.join(__dirname, '../.wwebjs_auth', userId);

    try {
        if (u?.client) {
            u.client.removeAllListeners();
            await u.client.logout().catch(err => console.warn(`[${userId}] Logout error (ignored):`, err.message));
            await u.client.destroy().catch(err => console.warn(`[${userId}] Destroy error (ignored):`, err.message));
            console.log(`[${userId}] Client destroyed successfully`);
            delete clients[userId];
        }

        await new Promise(res => setTimeout(res, 500));
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log(`[${userId}] Session folder deleted`);
        }
    } catch (err) {
        console.error(`[${userId}] Logout error:`, err);
    }
}

module.exports = { init, getStatus, getClient, logout };
