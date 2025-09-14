module.exports = {
    PORT: process.env.PORT || 3000,

    // If you want to force a specific Chrome location, set PUPPETEER_EXECUTABLE_PATH
    CHROME_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || null,

    // FFmpeg must be installed on the host and in PATH
    // Optional: tweak encoding quality
    FFMPEG_CRF: parseInt(process.env.FFMPEG_CRF || "28", 10), // 23..30
    FFMPEG_PRESET: process.env.FFMPEG_PRESET || "veryfast",
    MAX_SIZE_MB: parseInt(process.env.MAX_SIZE_MB || "16", 10) // WhatsApp client limit-ish
};
