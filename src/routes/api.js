const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { requireApiAuth, requireApiOwner } = require('../middleware/auth');
const { getBot } = require('../bot/whatsapp');
const User = require('../database/models/User');
const Command = require('../database/models/Command');
const Media = require('../database/models/Media');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

module.exports = function (io) {
  const router = express.Router();

  // ===== BOT =====
  router.get('/bot/status', requireApiAuth, (req, res) => {
    res.json(getBot(io).getStatus());
  });

  router.post('/bot/connect', requireApiOwner, async (req, res) => {
    const { mode, phoneNumber } = req.body;
    const bot = getBot(io);
    try {
      await bot.start({ mode: mode || 'qr', phoneNumber: phoneNumber || null });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/bot/logout', requireApiOwner, async (req, res) => {
    await getBot(io).logout();
    res.json({ ok: true });
  });

  // ===== COMANDOS =====
  router.get('/commands', requireApiAuth, async (req, res) => {
    const list = await Command.find().sort({ category: 1, name: 1 });
    res.json(list);
  });

  router.post('/commands', requireApiOwner, async (req, res) => {
    try {
      const data = req.body;
      if (data.aliases && typeof data.aliases === 'string') {
        data.aliases = data.aliases.split(',').map((s) => s.trim()).filter(Boolean);
      }
      data.enabled = data.enabled === 'true' || data.enabled === true || data.enabled === 'on';
      data.isSubmenu = data.isSubmenu === 'true' || data.isSubmenu === true || data.isSubmenu === 'on';
      const cmd = await Command.create(data);
      res.json(cmd);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/commands/:id', requireApiOwner, async (req, res) => {
    try {
      const data = req.body;
      if (data.aliases && typeof data.aliases === 'string') {
        data.aliases = data.aliases.split(',').map((s) => s.trim()).filter(Boolean);
      }
      data.enabled = data.enabled === 'true' || data.enabled === true || data.enabled === 'on';
      data.isSubmenu = data.isSubmenu === 'true' || data.isSubmenu === true || data.isSubmenu === 'on';
      const cmd = await Command.findByIdAndUpdate(req.params.id, data, { new: true });
      res.json(cmd);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/commands/:id', requireApiOwner, async (req, res) => {
    await Command.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  });

  // ===== MÍDIAS (upload Cloudinary) =====
  router.post('/media/upload', requireApiOwner, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo' });
      const mime = req.file.mimetype;
      let resourceType = 'image';
      let type = 'image';
      if (mime.startsWith('video')) { resourceType = 'video'; type = 'video'; }
      else if (mime.startsWith('audio')) { resourceType = 'video'; type = 'audio'; }
      else if (mime.includes('gif')) { type = 'gif'; }

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: resourceType, folder: 'dark-bot' },
          (err, result) => (err ? reject(err) : resolve(result))
        );
        stream.end(req.file.buffer);
      });

      const media = await Media.create({
        name: req.body.name || req.file.originalname,
        type,
        url: result.secure_url,
        publicId: result.public_id,
        size: req.file.size,
        uploadedBy: req.session.user.id,
        tags: (req.body.tags || '').split(',').map((s) => s.trim()).filter(Boolean),
      });
      res.json(media);
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/media/:id', requireApiOwner, async (req, res) => {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ error: 'Não encontrado' });
    try {
      const resourceType = media.type === 'video' || media.type === 'audio' ? 'video' : 'image';
      await cloudinary.uploader.destroy(media.publicId, { resource_type: resourceType });
    } catch (e) { console.warn('Falha ao deletar Cloudinary:', e.message); }
    await media.deleteOne();
    res.json({ ok: true });
  });

  // ===== USUÁRIOS =====
  router.get('/users', requireApiOwner, async (req, res) => {
    res.json(await User.find().sort({ createdAt: -1 }));
  });

  router.put('/users/:id', requireApiOwner, async (req, res) => {
    try {
      const { role, active, premiumUntil, name, whatsappNumber } = req.body;
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: 'Não encontrado' });
      if (user.role === 'owner' && role && role !== 'owner') {
        return res.status(400).json({ error: 'Não é permitido remover o dono' });
      }
      if (role) user.role = role;
      if (typeof active !== 'undefined') user.active = active === 'true' || active === true;
      if (premiumUntil) user.premiumUntil = new Date(premiumUntil);
      if (name) user.name = name;
      if (typeof whatsappNumber !== 'undefined') user.whatsappNumber = whatsappNumber.replace(/\D/g, '');
      await user.save();
      res.json(user);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/users/:id', requireApiOwner, async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Não encontrado' });
    if (user.role === 'owner') return res.status(400).json({ error: 'Não pode deletar o dono' });
    await user.deleteOne();
    res.json({ ok: true });
  });

  return router;
};
