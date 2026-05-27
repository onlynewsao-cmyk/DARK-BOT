const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    name: { type: String, default: '' },
    whatsappNumber: { type: String, default: '' }, // ex: 244XXXXXXXXX
    role: { type: String, enum: ['owner', 'premium', 'free'], default: 'free' },
    active: { type: Boolean, default: true },
    premiumUntil: { type: Date, default: null },
    commandsUsed: { type: Number, default: 0 },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
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
