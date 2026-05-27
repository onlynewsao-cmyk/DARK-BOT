require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  sessionSecret: process.env.SESSION_SECRET || 'dark-bot-secret-change-me',
  appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`,

  owner: {
    name: process.env.OWNER_NAME || 'Dark Net',
    number: process.env.OWNER_NUMBER || '244945280380',
    username: process.env.OWNER_USERNAME || 'darknet',
    password: process.env.OWNER_PASSWORD || 'DarkNet@2026',
  },

  bot: {
    name: process.env.BOT_NAME || 'DARK BOT',
    number: process.env.BOT_NUMBER || '244949926074',
    prefix: process.env.BOT_PREFIX || '!',
  },

  mongodb: {
    uri: process.env.MONGODB_URI,
  },

  cloudinary: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  },
};
