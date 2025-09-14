/* const express = require('express');
const router = express.Router();
const whatsappClient = require('../services/whatsappClient'); // must import
const { sendVideo } = require('../services/videoService');

// Send video endpoint (user-specific)
router.post('/send/:userId', async (req, res) => {
    const { userId } = req.params;
    const { number, videoUrl, localPath, caption } = req.body;

    if (!userId) return res.status(400).send('userId is required');
    if (!number) return res.status(400).send('number and videoUrl are required');//|| !videoUrl

    if (!videoUrl && !localPath) {
        return res.status(400).send('Either videoUrl or localPath is required');
    }

    try {
        // Ensure client initialized for user
        await whatsappClient.init(userId);

        // Send video
        await sendVideo({ userId, number, videoUrl, localPath, caption });

        res.send(`Video sent successfully. ${number}`);
    } catch (err) {
        console.error(`[${userId}] Error sending video:`, err);
        res.status(500).send(err.message);
    }
});

module.exports = router; */

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


