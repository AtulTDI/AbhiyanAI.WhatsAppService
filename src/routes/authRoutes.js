const express = require('express');
const router = express.Router();
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const whatsappClient = require('../services/whatsappClient');

// Helper: wipe session folder
function clearSession(userId) {
    const sessionPath = path.join(__dirname, '..', '.wwebjs_auth', `session-${userId}`);
    try {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log(`[${userId}] 🗑️ Cleared session folder: ${sessionPath}`);
    } catch (err) {
        console.warn(`[${userId}] Failed to clear session: ${err.message}`);
    }
}

// Wait for client to become ready (max timeout ms)
async function waitForReady(userId, timeout = 10000, interval = 500) {
    let waited = 0;
    let status = whatsappClient.getStatus(userId);

    while ((!status || !status.isReady) && waited < timeout) {
        await new Promise(r => setTimeout(r, interval));
        waited += interval;
        status = whatsappClient.getStatus(userId);
    }

    return status;
}

// Get QR code for user (auto-init if needed)
router.get('/qr/:userId', async (req, res) => {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    try {
        let status = whatsappClient.getStatus(userId);

        // Initialize client if not exists
        if (!status) {
            console.log(`[${userId}] 🔄 Initializing WhatsApp client...`);
            await whatsappClient.init(userId);
            status = await waitForReady(userId, 2000, 500); // allow QR to generate
        }

        // Already authenticated → no QR needed
        if (status.isReady) {
            return res.json({
                qr: null,
                isReady: true,
                message: "Already authenticated",
                loggedInUser: status.loggedInUser
            });
        }

        // QR exists → send QR image
        if (status.lastQr) {
            const dataUrl = await qrcode.toDataURL(status.lastQr);
            return res.json({
                qr: dataUrl,
                isReady: false,
                lastQrTime: status.lastQrTime,
                message: "Scan the QR code"
            });
        }

        // Waiting for QR generation
        return res.json({
            qr: null,
            isReady: false,
            message: "Waiting for QR..."
        });

    } catch (err) {
        console.error(`[${userId}] QR fetch error:`, err);
        res.status(500).json({ message: err.message });
    }
});

// Status endpoint
router.get('/status/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        let status = whatsappClient.getStatus(userId);

        // Initialize client if not exists
        if (!status) await whatsappClient.init(userId);

        // Wait for ready
        status = await waitForReady(userId);

        res.json({
            isReady: status?.isReady || false,
            lastQr: status?.lastQr || null,
            lastQrTime: status?.lastQrTime || null,
            loggedInUser: status?.loggedInUser || null,
            message: status?.isReady ? 'Authenticated' : 'Not ready yet'
        });
    } catch (err) {
        console.error(`[${userId}] Status error:`, err);
        res.status(500).json({ isReady: false, message: err.message });
    }
});

// Get logged in user info
router.get('/me/:userId', (req, res) => {
    const { userId } = req.params;
    const status = whatsappClient.getStatus(userId);
    if (!status || !status.isReady || !status.loggedInUser) {
        return res.status(400).json({ success: false, message: 'User not authenticated' });
    }
    res.json({ success: true, user: status.loggedInUser });
});

// Logout & clear session
router.post('/logout/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        await whatsappClient.logout(userId);
        clearSession(userId);
        res.json({ success: true, message: 'Logged out and session deleted' });
    } catch (err) {
        console.error(`[${userId}] Logout failed:`, err);
        res.status(500).json({ success: false, message: 'Logout failed' });
    }
});

module.exports = router;
