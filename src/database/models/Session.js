const mongoose = require('mongoose');

// Para persistir credenciais Baileys no MongoDB (não perder ao reiniciar Render)
// IMPORTANTE: usar coleção diferente da do express-session (que usa "sessions")
const SessionSchema = new mongoose.Schema({
  fileName: { type: String, required: true, unique: true },
  content: { type: String, required: true }, // JSON serializado
}, {
  timestamps: true,
  collection: 'baileys_sessions', // 🔑 Coleção exclusiva (não conflita com express-session)
});

module.exports = mongoose.model('Session', SessionSchema);
