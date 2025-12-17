// routes/sendMediaRoute.js
const express = require("express");
const router = express.Router();
const { sendMediaToWhatsApp } = require("../services/sendMediaService");
const whatsappClient = require("../services/whatsappClient");

/**
 * Send media:
 * POST /media/send/:userId
 * 
 * Body:
 * {
 *    "number": "919812345678",
 *    "mediaUrl": "https://s3-url/video.mp4",
 *    "caption": "Hello!"
 * }
 */
router.post("/send/:userId", async (req, res) => {
    const { userId } = req.params;
    const {  number, videoUrl, caption } = req.body;

    console.log(`\n📩 API Request /media/send/${userId}`);

    if (!userId) return res.status(400).json({ error: "userId required" });
    if (!number) return res.status(400).json({ error: "number required" });
    if (!videoUrl) return res.status(400).json({ error: "videoUrl required" });

    try {
        // Ensure WhatsApp client exists and is ready
        let status = whatsappClient.getStatus(userId);

        if (!status) {
            console.log(`[${userId}] Initializing new WhatsApp client...`);
            await whatsappClient.init(userId);
            status = whatsappClient.getStatus(userId);
        }

        if (!status || !status.isReady) {
            return res.status(503).json({
                error: "WhatsApp not connected. Scan QR first.",
                status
            });
        }

        const client = whatsappClient.getClient(userId);

        if (!client) {
            console.error(`${logPrefix} ❌ CLIENT_NOT_INITIALIZED`);
            throw new Error("WhatsApp client not initialized for this userId");
        }

        // Send media using service
        const result = await sendMediaToWhatsApp({
            client,
            userId,
            number,
            videoUrl,
            caption
        });

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        return res.json({
            success: true,
            message: `Media sent successfully to ${number}`
        });

    } catch (err) {
        console.error(`[${userId}] ❌ SERVER ERROR:`, err.message);
        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

module.exports = router;
