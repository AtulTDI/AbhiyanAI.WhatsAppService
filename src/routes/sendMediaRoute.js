const express = require("express");
const router = express.Router();

const {
    sendMediaToWhatsApp,
    sendVideo,
    sendImage
} = require("../services/sendMediaService");

const whatsappClient = require("../services/whatsappClient");


// ---------------------------------------------------------
// Helper: Ensure WhatsApp Client Available & Ready
// ---------------------------------------------------------
async function ensureClientReady(userId, res) {
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
        return res.status(500).json({
            error: "WhatsApp client not initialized for this userId"
        });
    }

    return client;
}



// ---------------------------------------------------------
// AUTO DETECT (IMAGE / VIDEO)
// POST /media/send/:userId
// ---------------------------------------------------------
router.post("/send/:userId", async (req, res) => {
    const { userId } = req.params;
    const { number, videoUrl, caption } = req.body;

    console.log(`\n📩 API Request: /media/send/${userId}`);

    if (!userId) return res.status(400).json({ error: "userId is required" });
    if (!number) return res.status(400).json({ error: "number is required" });
    if (!videoUrl) return res.status(400).json({ error: "videoUrl is required" });

    try {
        const client = await ensureClientReady(userId, res);
        if (!client) return;

        const result = await sendMediaToWhatsApp({
            client,
            userId,
            number,
            videoUrl,
            caption
        });

        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }

        return res.json({
            success: true,
            message: `Media sent successfully to ${number}`
        });

    } catch (err) {
        console.error(`[${userId}] ❌ SERVER ERROR:`, err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});



// ---------------------------------------------------------
// SEND VIDEO ONLY
// POST /media/send-video/:userId
// ---------------------------------------------------------
router.post("/send-video/:userId", async (req, res) => {
    const { userId } = req.params;
    const { number, videoUrl, caption } = req.body;

    console.log(`\n API Request: /media/send-video/${userId}`);

    if (!userId) return res.status(400).json({ error: "userId is required" });
    if (!number) return res.status(400).json({ error: "number is required" });
    if (!videoUrl) return res.status(400).json({ error: "videoUrl is required" });

    try {
        const client = await ensureClientReady(userId, res);
        if (!client) return;

        const result = await sendVideo({
            client,
            userId,
            number,
            videoUrl,
            caption
        });

        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }

        return res.json({
            success: true,
            message: `Video sent successfully to ${number}`
        });

    } catch (err) {
        console.error(`[${userId}] ❌ SERVER ERROR:`, err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});



// ---------------------------------------------------------
// SEND IMAGE ONLY
// POST /media/send-image/:userId
// ---------------------------------------------------------
router.post("/send-image/:userId", async (req, res) => {
    const { userId } = req.params;
    const { number, imageUrl, caption } = req.body;

    console.log(`\n API Request: /media/send-image/${userId}`);

    if (!userId) return res.status(400).json({ error: "userId is required" });
    if (!number) return res.status(400).json({ error: "number is required" });
    if (!imageUrl) return res.status(400).json({ error: "imageUrl is required" });

    try {
        const client = await ensureClientReady(userId, res);
        if (!client) return;

        const result = await sendImage({
            client,
            userId,
            number,
            imageUrl,
            caption
        });

        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }

        return res.json({
            success: true,
            message: `Image sent successfully to ${number}`
        });

    } catch (err) {
        console.error(`[${userId}] ❌ SERVER ERROR:`, err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


module.exports = router;
