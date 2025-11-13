const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { MessageMedia } = require('whatsapp-web.js');
const whatsappClient = require('./whatsappClient');
const { FFMPEG_CRF, FFMPEG_PRESET, MAX_SIZE_MB } = require('../config/env');

// Track last send times per user
//const userDelays = {}; // userId => timestamp

/**
 * Sleep helper
 * @param {number} ms 
 */
function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}

/**
 * Compress a video using FFmpeg
 * @param {string} inputPath 
 * @param {string} outputPath 
 * @returns {Promise<string>}
 */
function compressVideo(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions([
                '-vf', 'scale=640:-2',
                '-c:v', 'libx264',
                '-crf', String(FFMPEG_CRF),
                '-preset', FFMPEG_PRESET,
                '-c:a', 'aac',
                '-b:a', '64k'
            ])
            .save(outputPath)
            .on('end', () => resolve(outputPath))
            .on('error', reject);
    });
}

/**
 * Get file size in MB
 * @param {string} filepath 
 * @returns {number}
 */
function fileSizeMB(filepath) {
    const b = fs.statSync(filepath).size;
    return b / (1024 * 1024);
}

/**
 * Create a temporary folder for a user session
 * @param {string} userId 
 * @returns {string} folder path
 */
function getUserTempFolder(userId) {
    const folderName = `${userId}_${Date.now()}`;
    const folderPath = path.join(__dirname, '../../temp_videos', folderName);
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
    return folderPath;
}

/**
 * Try sending a WhatsApp video
 */
async function trySend(client, numberId, sendPath, caption) {
    const media = MessageMedia.fromFilePath(sendPath);
    return client.sendMessage(numberId._serialized, media, { caption });
}

/**
 * Send video to a WhatsApp number
 * @param {Object} params
 * @param {string} params.userId - WhatsApp session user ID
 * @param {string} params.number - Target WhatsApp number
 * @param {string} params.videoUrl - Remote video URL (S3 or other)
 * @param {string} [params.caption] - Optional caption
 */
async function sendVideo({ userId, number, videoUrl, caption }) {
    if (!videoUrl) throw new Error("videoUrl must be provided.");

    // Enforce 5s delay per user
    /* const now = Date.now();
    const lastSent = userDelays[userId] || 0;
    const elapsed = now - lastSent;
    const wait = 5000 - elapsed;
    if (wait > 0) {
        console.log(`[${userId}] Waiting ${wait}ms before sending next video to prevent spam...`);
        await delay(wait);
    }
    userDelays[userId] = Date.now(); */

    const tempFolder = getUserTempFolder(userId);
    const tempPath = path.join(tempFolder, `temp_video.mp4`);
    const compressedPath = path.join(tempFolder, `compressed_video.mp4`);

    try {
        console.log(`[${userId}] Downloading video from: ${videoUrl}`);
        try {
            const response = await axios.get(videoUrl, { responseType: 'arraybuffer' });
            fs.writeFileSync(tempPath, response.data);
        } catch (err) {
            console.error("❌ AXIOS ERROR: ", err.response?.status, err.response?.statusText);
            console.error("❌ RESPONSE BODY:", err.response?.data?.toString());
            throw err;
        }
        let sendPath = tempPath;

        // Compress if too large
        if (fileSizeMB(sendPath) > (MAX_SIZE_MB - 0.5)) {
            console.log(`[${userId}] Compressing video (too large)`);
            await compressVideo(sendPath, compressedPath);
            sendPath = compressedPath;
        }

        // Send via WhatsApp using user-specific session
        const client = whatsappClient.getClient(userId);

        // Resolve number
        const numberId = await client.getNumberId(number);
        if (!numberId) {
            throw new Error(`❌ The number ${number} is not registered on WhatsApp.`);
        }

        // Check if chat exists
        let chatExists = false;


        // If chat does not exist → create it
        if (!chatExists) {
            console.log(`[${userId}] 📩 Creating initial chat with ${number}...`);

            await client.sendMessage(numberId._serialized, "\u200B");
            await delay(3000); // MUST WAIT
        }
        try {
            await trySend(client, numberId, sendPath, caption);
            console.log(`[${userId}] ✅ Video sent to ${number}`);
        } catch (err) {
            console.error(`[${userId}] ❌ Media send failed even after chat init:`, err);
            throw err;
        }


        //const media = MessageMedia.fromFilePath(sendPath);
        //await client.sendMessage(`${number}@c.us`, media, { caption });

        //console.log(`[${userId}] ✅ Video sent to ${number}`);

    } catch (err) {
        console.error(`[${userId}] ❌ Error sending video:`, err);
        throw err;
    } finally {
        // Cleanup temp folder
        try {
            if (fs.existsSync(tempFolder)) {
                fs.rmSync(tempFolder, { recursive: true, force: true });
                console.log(`[${userId}] Temp folder cleaned up: ${tempFolder}`);
            }
        } catch (err) {
            console.warn(`[${userId}] Failed to cleanup temp folder:`, err.message);
        }
    }
}

module.exports = { sendVideo };
