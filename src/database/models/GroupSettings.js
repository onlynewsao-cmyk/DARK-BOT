/**
 * Configurações por grupo (antilink, antispam, welcome, bot ativo, etc)
 */
const mongoose = require('mongoose');

const GroupSettingsSchema = new mongoose.Schema({
  groupJid: { type: String, required: true, unique: true, index: true },
  groupName: { type: String, default: '' },

  botEnabled: { type: Boolean, default: true },
  antilink: { type: Boolean, default: false },
  antispam: { type: Boolean, default: false },
  welcome: { type: Boolean, default: true },
  goodbye: { type: Boolean, default: true },

  customWelcome: { type: String, default: '' },
  customGoodbye: { type: String, default: '' },

  onlyAdmins: { type: Boolean, default: false }, // só admins podem usar bot
  blockedCommands: [{ type: String }],

  participantsCount: { type: Number, default: 0 },
  totalMessages: { type: Number, default: 0 },
  totalCommands: { type: Number, default: 0 },

  lastActivity: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('GroupSettings', GroupSettingsSchema);
