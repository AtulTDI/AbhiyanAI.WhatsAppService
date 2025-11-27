 const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const { PORT } = require('./src/config/env');
const whatsappClient = require('./src/services/whatsappClient');
const authRoutes = require('./src/routes/authRoutes');
//const videoRoutes = require('./src/routes/videoRoutes');
const sendMediaRoute = require('./src/routes/sendMediaRoute');

const app = express();
app.use(cors()); // allow frontend to call this service
app.use(bodyParser.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/media', sendMediaRoute);
//app.use('/api/video', videoRoutes);

// Start server
app.listen(PORT, '0.0.0.0', async () => {
    console.log('🟡 Loaded PORT:', PORT);
    console.log(`✅ WhatsApp service running at http://0.0.0.0:${PORT}`);

    try {
        // Initialize default session
        await whatsappClient.init('PHC-session');
        console.log('[PHC-session] WhatsApp client initialized.');
    } catch (err) {
        console.error('Failed to initialize WhatsApp client:', err);
    }
});

// Graceful shutdown: logout all sessions
process.on('SIGINT', async () => {
    console.log('Shutting down... Logging out WhatsApp clients.');
    try {
        await whatsappClient.logout('PHC-session');
    } catch (err) {
        console.warn('Error during logout:', err.message);
    }
    process.exit();
});