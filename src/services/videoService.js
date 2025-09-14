const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { MessageMedia } = require('whatsapp-web.js');
const whatsappClient = require('./whatsappClient');
const { FFMPEG_CRF, FFMPEG_PRESET, MAX_SIZE_MB } = require('../config/env');

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
 * Send video to a WhatsApp number
 * @param {Object} params
 * @param {string} params.userId - WhatsApp session user ID
 * @param {string} params.number - Target WhatsApp number
 * @param {string} params.videoUrl - Remote video URL (S3 or other)
 * @param {string} [params.caption] - Optional caption
 */
async function sendVideo({ userId, number, videoUrl, caption }) {
    if (!videoUrl) throw new Error("videoUrl must be provided.");

    const tempFolder = getUserTempFolder(userId);
    const tempPath = path.join(tempFolder, `temp_video.mp4`);
    const compressedPath = path.join(tempFolder, `compressed_video.mp4`);

    try {
        console.log(`[${userId}] Downloading video from: ${videoUrl}`);
        const response = await axios.get(videoUrl, { responseType: 'arraybuffer' });
        fs.writeFileSync(tempPath, response.data);
        let sendPath = tempPath;

        // Compress if too large
        if (fileSizeMB(sendPath) > (MAX_SIZE_MB - 0.5)) {
            console.log(`[${userId}] Compressing video (too large)`);
            await compressVideo(sendPath, compressedPath);
            sendPath = compressedPath;
        }

        // Send via WhatsApp using user-specific session
        const client = whatsappClient.getClient(userId);
        const media = MessageMedia.fromFilePath(sendPath);
        await client.sendMessage(`${number}@c.us`, media, { caption });

        console.log(`[${userId}] ✅ Video sent to ${number}`);
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
