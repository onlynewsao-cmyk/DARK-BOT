const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    password: { type: String, required: true },
    name: { type: String, default: '' },
    // ÚNICO - 1 número = 1 usuário (sparse permite vários sem número)
    whatsappNumber: { type: String, default: '' },
    role: { type: String, enum: ['owner', 'premium', 'free'], default: 'free' },
    active: { type: Boolean, default: true },
    premiumUntil: { type: Date, default: null },
    commandsUsed: { type: Number, default: 0 },
    lastLogin: { type: Date, default: null },
    autoCreated: { type: Boolean, default: false }, // criado pelo bot (via WhatsApp)
    lastSeenAt: { type: Date, default: Date.now },
    avatar: { type: String, default: '' }, // URL da foto de perfil
  },
  { timestamps: true }
);

// Índice único parcial: whatsappNumber é único QUANDO existe
UserSchema.index(
  { whatsappNumber: 1 },
  { unique: true, partialFilterExpression: { whatsappNumber: { $type: 'string', $ne: '' } } }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  // Não re-hash se já é bcrypt (60 chars começando com $2)
  if (this.password && this.password.length === 60 && this.password.startsWith('$2')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

UserSchema.methods.isPremium = function () {
  if (this.role === 'owner') return true;
  if (this.role !== 'premium') return false;
  if (!this.premiumUntil) return true;
  return new Date(this.premiumUntil) > new Date();
};

module.exports = mongoose.model('User', UserSchema);
