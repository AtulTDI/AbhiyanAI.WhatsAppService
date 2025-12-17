// services/sendMediaService.js
const axios = require("axios");
const mime = require("mime-types");
const { MessageMedia } = require("whatsapp-web.js");


// ---------------------------------------------------------
// User-specific fixed delay tracking (20 seconds)
// ---------------------------------------------------------
const lastSendTimeByUser = new Map(); // userId -> timestamp (ms)

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function enforceUserDelay(userId, delaySeconds = 20) {
    const now = Date.now();
    const lastTime = lastSendTimeByUser.get(userId) || 0;

    const requiredDelayMs = delaySeconds * 1000;
    const elapsed = now - lastTime;

    if (elapsed < requiredDelayMs) {
        const waitMs = requiredDelayMs - elapsed;
        console.log(
            `[DELAY user=${userId}] ⏳ Waiting ${Math.ceil(waitMs / 1000)} seconds`
        );
        
        await delay(waitMs);
    }

    // Update timestamp just before sending
    lastSendTimeByUser.set(userId, Date.now());
}



/* ---------------------------------------------------------
 * Helper: Download file and return { buffer, mime, fileName }
 * --------------------------------------------------------- */
async function downloadMedia(mediaUrl, logPrefix) {
    try {
        console.log(`${logPrefix} Downloading from: ${mediaUrl}`);

        const response = await axios.get(mediaUrl, { responseType: "arraybuffer" });
        const buffer = Buffer.from(response.data, "binary");
        const mimeType = response.headers["content-type"] || mime.lookup(mediaUrl);
        const fileName = mediaUrl.split("/").pop();

        console.log(`${logPrefix} MIME detected = ${mimeType}`);

        return { buffer, mimeType, fileName };
    } catch (err) {
        console.error(`${logPrefix} ❌ DOWNLOAD ERROR: ${err.message}`);
        throw new Error("DOWNLOAD_ERROR: Unable to download media from URL");
    }
}

/* ---------------------------------------------------------
 * Helper: Convert buffer to WhatsApp MessageMedia
 * --------------------------------------------------------- */
function buildMedia(buffer, mimeType, fileName) {
    const base64Data = buffer.toString("base64");
    return new MessageMedia(mimeType, base64Data, fileName);
}

/* ---------------------------------------------------------
 * Validate WhatsApp number
 * --------------------------------------------------------- */
async function validateNumber(client, number) {
    const numberId = await client.getNumberId(number);
    if (!numberId) {
        throw new Error(`❌ Number ${number} is not registered on WhatsApp.`);
    }
    return `${number}@c.us`;
}

/* ---------------------------------------------------------
 * SEND VIDEO
 * --------------------------------------------------------- */
async function sendVideo({ client, userId, number, videoUrl, caption }) {
    const logPrefix = `[SEND_VIDEO user=${userId} number=${number}]`;

    try {
        const chatId = await validateNumber(client, number);
        const { buffer, mimeType, fileName } = await downloadMedia(videoUrl, logPrefix);

        if (!mimeType.startsWith("video/")) {
            throw new Error(`❌ Provided URL is not a video. MIME = ${mimeType}`);
        }

        const media = buildMedia(buffer, mimeType, fileName);

        await enforceUserDelay(userId);

        console.log(`${logPrefix} 🎬 Sending VIDEO...`);
        await client.sendMessage(chatId, media, { caption: caption || "" });

        console.log(`${logPrefix} ✅ Video sent successfully`);
        return { success: true };
    } catch (err) {
        console.log(`[DELAY user=${userId}] ⏳ Waiting 20 seconds after failure`);
        await delay(20_000);
        console.error(`${logPrefix} ❌ FINAL ERROR: ${err.message}`);
        return { success: false, error: err.message };
    }
}

/* ---------------------------------------------------------
 * SEND IMAGE
 * --------------------------------------------------------- */
async function sendImage({ client, userId, number, imageUrl, caption }) {
    const logPrefix = `[SEND_IMAGE user=${userId} number=${number}]`;

    try {
        const chatId = await validateNumber(client, number);
        const { buffer, mimeType, fileName } = await downloadMedia(imageUrl, logPrefix);

        if (!mimeType.startsWith("image/")) {
            throw new Error(`❌ Provided URL is not an image. MIME = ${mimeType}`);
        }

        const media = buildMedia(buffer, mimeType, fileName);

        await enforceUserDelay(userId);

        console.log(`${logPrefix} 🖼 Sending IMAGE...`);
        await client.sendMessage(chatId, media, { caption: caption || "" });

        console.log(`${logPrefix} ✅ Image sent successfully`);
        return { success: true };
    } catch (err) {
        console.log(`[DELAY user=${userId}] ⏳ Waiting 20 seconds after failure`);
        await delay(20_000);
        console.error(`${logPrefix} ❌ FINAL ERROR: ${err.message}`);
        return { success: false, error: err.message };
    }
}

/* ---------------------------------------------------------
 * AUTO-DETECT (image/video/other)
 * --------------------------------------------------------- */
async function sendMediaToWhatsApp({ client, userId, number, mediaUrl, caption }) {
    const logPrefix = `[SEND_MEDIA user=${userId} number=${number}]`;

    try {
        const { mimeType } = await downloadMedia(mediaUrl, logPrefix);

        if (mimeType.startsWith("video/")) {
            return await sendVideo({ client, userId, number, videoUrl: mediaUrl, caption });
        }

        if (mimeType.startsWith("image/")) {
            return await sendImage({ client, userId, number, imageUrl: mediaUrl, caption });
        }

        throw new Error(`❌ Unsupported media type: ${mimeType}`);
    } catch (err) {
        console.error(`${logPrefix} ❌ FINAL ERROR: ${err.message}`);
        return { success: false, error: err.message };
    }
}

module.exports = {
    sendMediaToWhatsApp,
    sendVideo,
    sendImage
};
