const express = require('express');
const router = express.Router();
const { sendVideo } = require('../services/videoService');
const whatsappClient = require('../services/whatsappClient');

/**
 * Send video to a WhatsApp number
 * Requires:
 * - userId: WhatsApp session user ID
 * - number: target WhatsApp number
 * - videoUrl: remote video URL (S3 or other)
 * - caption: optional
 */
router.post('/send/:userId', async (req, res) => {
    const { userId } = req.params;
    const { number, videoUrl, caption } = req.body;

    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!number || !videoUrl) return res.status(400).json({ error: 'number and videoUrl are required' });

    try {
        // Ensure WhatsApp client exists and is ready
        let status = whatsappClient.getStatus(userId);

        if (!status) {
            console.log(`[${userId}] Client not initialized. Initializing now...`);
            await whatsappClient.init(userId);
            status = whatsappClient.getStatus(userId);
        }

        if (!status || !status.isReady) {
            return res.status(503).json({ error: 'WhatsApp not connected. Scan QR first.' });
        }

        // Send video via user-specific session
        await sendVideo({ userId, number, videoUrl, caption });
        console.log(`[${userId}] Video sent to ${number}`);

        res.json({ success: true, message: `Video sent to ${number}` });

    } catch (err) {
        console.error(`[${userId}] Error sending video:`, err);
        res.status(500).json({ error: 'Failed to send video', details: err.message });
    }
});

module.exports = router;