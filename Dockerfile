# ----------------------------
# Dockerfile for WhatsApp Service
# ----------------------------

# Use official Node.js 18 LTS image (Debian-based)
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first (for caching npm install)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Install system dependencies for Puppeteer and FFmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    chromium \
    chromium-driver \
    ca-certificates \
    fonts-freefont-ttf \
    libnss3 \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libatk1.0-0 \
    libharfbuzz0b \
    wget \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Copy the rest of the application code
COPY . .

# Expose the port (match your src/config/env.js PORT)
EXPOSE 3000

# Set Chromium executable path for Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Start the app
CMD ["node", "app.js"]
