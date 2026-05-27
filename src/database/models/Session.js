const mongoose = require('mongoose');

// Para persistir credenciais Baileys no MongoDB (não perder ao reiniciar Render)
const SessionSchema = new mongoose.Schema({
  fileName: { type: String, required: true, unique: true },
  content: { type: String, required: true }, // JSON serializado
}, { timestamps: true });

module.exports = mongoose.model('Session', SessionSchema);
