const mongoose = require('mongoose');

const CommandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, lowercase: true },
    aliases: [{ type: String, lowercase: true }],
    category: { type: String, default: 'geral' },
    description: { type: String, default: '' },
    response: { type: String, default: '' }, // texto da resposta (suporta variáveis: {user}, {bot}, {owner}, {group})
    mediaUrl: { type: String, default: '' }, // URL Cloudinary (imagem, vídeo, gif)
    mediaType: { type: String, enum: ['', 'image', 'video', 'gif', 'audio', 'sticker'], default: '' },
    accessLevel: { type: String, enum: ['all', 'premium', 'owner'], default: 'all' },
    enabled: { type: Boolean, default: true },
    isSubmenu: { type: Boolean, default: false },
    parentCommand: { type: String, default: '' },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Command', CommandSchema);
