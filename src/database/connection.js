const mongoose = require('mongoose');
const config = require('../config');

let isConnected = false;

async function connectDB() {
  if (isConnected) return mongoose.connection;
  if (!config.mongodb.uri) {
    console.warn('⚠️  MONGODB_URI não definida. O bot funcionará SEM persistência.');
    return null;
  }
  try {
    await mongoose.connect(config.mongodb.uri, {
      serverSelectionTimeoutMS: 10000,
    });
    isConnected = true;
    console.log('✅ MongoDB conectado');
    return mongoose.connection;
  } catch (err) {
    console.error('❌ Erro ao conectar MongoDB:', err.message);
    return null;
  }
}

module.exports = { connectDB, mongoose };
