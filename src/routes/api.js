const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { requireApiAuth, requireApiOwner } = require('../middleware/auth');
const { getBot } = require('../bot/whatsapp');
const User = require('../database/models/User');
const Command = require('../database/models/Command');
const Media = require('../database/models/Media');
const BotConfig = require('../database/models/BotConfig');
const Schedule = require('../database/models/Schedule');
const Payment = require('../database/models/Payment');
const Log = require('../database/models/Log');
const CommandOverride = require('../database/models/CommandOverride');
const GroupSettings = require('../database/models/GroupSettings');
const mediaHandler = require('../bot/mediaHandler');
const DecryptLog = require('../database/models/DecryptLog');
const decrypter = require('../decrypter');
const { formatForWhatsApp } = require('../decrypter/formatter');
const config = require('../config');
const ai = require('../bot/ai');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

module.exports = function (io) {
  const router = express.Router();

  // ===== BOT =====
  router.get('/bot/status', requireApiAuth, (req, res) => res.json(getBot(io).getStatus()));

  router.post('/bot/connect', requireApiOwner, async (req, res) => {
    const { mode, phoneNumber } = req.body;
    const bot = getBot(io);
    try {
      bot.start({ mode: mode || 'qr', phoneNumber: phoneNumber || null })
        .catch(err => console.error('Start:', err));
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/bot/logout', requireApiOwner, async (req, res) => {
    await getBot(io).logout();
    res.json({ ok: true });
  });

  router.post('/bot/reset', requireApiOwner, async (req, res) => {
    try {
      const bot = getBot(io);
      await bot.logout();
      // Limpa a sessão do MongoDB também
      try {
        const Session = require('../database/models/Session');
        await Session.deleteMany({});
      } catch (e) {}
      res.json({ ok: true, message: 'Sessão limpa completamente' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===== COMANDOS =====
  router.get('/commands', requireApiAuth, async (req, res) => {
    res.json(await Command.find().sort({ category: 1, name: 1 }));
  });

  router.post('/commands', requireApiOwner, async (req, res) => {
    try {
      const data = req.body;
      if (data.aliases && typeof data.aliases === 'string') {
        data.aliases = data.aliases.split(',').map(s => s.trim()).filter(Boolean);
      }
      data.enabled = data.enabled === 'true' || data.enabled === true || data.enabled === 'on';
      data.isSubmenu = data.isSubmenu === 'true' || data.isSubmenu === true || data.isSubmenu === 'on';
      res.json(await Command.create(data));
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  router.put('/commands/:id', requireApiOwner, async (req, res) => {
    try {
      const data = req.body;
      if (data.aliases && typeof data.aliases === 'string') {
        data.aliases = data.aliases.split(',').map(s => s.trim()).filter(Boolean);
      }
      data.enabled = data.enabled === 'true' || data.enabled === true || data.enabled === 'on';
      data.isSubmenu = data.isSubmenu === 'true' || data.isSubmenu === true || data.isSubmenu === 'on';
      res.json(await Command.findByIdAndUpdate(req.params.id, data, { new: true }));
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  router.delete('/commands/:id', requireApiOwner, async (req, res) => {
    await Command.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  });

  // ===== MÍDIAS =====
  router.post('/media/upload', requireApiOwner, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo' });
      const mime = req.file.mimetype;
      let resourceType = 'image', type = 'image';
      if (mime.startsWith('video')) { resourceType = 'video'; type = 'video'; }
      else if (mime.startsWith('audio')) { resourceType = 'video'; type = 'audio'; }
      else if (mime.includes('gif')) type = 'gif';
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: resourceType, folder: 'dark-bot' },
          (err, r) => err ? reject(err) : resolve(r)
        );
        stream.end(req.file.buffer);
      });
      const media = await Media.create({
        name: req.body.name || req.file.originalname,
        type, url: result.secure_url, publicId: result.public_id, size: req.file.size,
        uploadedBy: req.session.user.id,
        tags: (req.body.tags || '').split(',').map(s => s.trim()).filter(Boolean),
      });
      res.json(media);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/media/:id', requireApiOwner, async (req, res) => {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ error: 'Não encontrado' });
    try {
      const rt = media.type === 'video' || media.type === 'audio' ? 'video' : 'image';
      await cloudinary.uploader.destroy(media.publicId, { resource_type: rt });
    } catch (e) {}
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
      if (user.role === 'owner' && role && role !== 'owner') return res.status(400).json({ error: 'Não pode remover dono' });
      if (role) user.role = role;
      if (typeof active !== 'undefined') user.active = active === 'true' || active === true;
      if (premiumUntil) user.premiumUntil = new Date(premiumUntil);
      if (name) user.name = name;
      if (typeof whatsappNumber !== 'undefined') user.whatsappNumber = whatsappNumber.replace(/\D/g, '');
      await user.save();
      res.json(user);
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  router.delete('/users/:id', requireApiOwner, async (req, res) => {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ error: 'Não encontrado' });
    if (u.role === 'owner') return res.status(400).json({ error: 'Não pode deletar dono' });
    await u.deleteOne();
    res.json({ ok: true });
  });

  // ===== BROADCAST =====
  router.post('/broadcast', requireApiOwner, async (req, res) => {
    const { text, mediaUrl, mediaType, delay = 2 } = req.body;
    if (!text) return res.status(400).json({ error: 'Texto obrigatório' });
    const bot = getBot(io);
    if (bot.getStatus().status !== 'connected') return res.status(400).json({ error: 'Bot não conectado' });
    res.json({ ok: true });
    (async () => {
      try {
        const chats = await bot.sock.groupFetchAllParticipating();
        const ids = Object.keys(chats);
        let count = 0;
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          const name = chats[id]?.subject || id;
          try {
            io.emit('broadcast:progress', { current: i+1, total: ids.length, group: name });
            if (mediaUrl && mediaType) {
              const buf = await mediaHandler.fetchBuffer(mediaUrl);
              const payload = mediaType === 'image' || mediaType === 'gif' ? { image: buf, caption: text }
                : mediaType === 'video' ? { video: buf, caption: text }
                : mediaType === 'audio' ? { audio: buf, mimetype: 'audio/mp4' }
                : { text };
              await bot.sock.sendMessage(id, payload);
            } else { await bot.sock.sendMessage(id, { text }); }
            count++;
            await new Promise(r => setTimeout(r, delay * 1000));
          } catch (e) { io.emit('broadcast:error', { message: `${name}: ${e.message}` }); }
        }
        io.emit('broadcast:done', { count });
      } catch (err) { io.emit('broadcast:error', { message: err.message }); }
    })();
  });

  // ===== SCHEDULE =====
  router.post('/schedule', requireApiOwner, async (req, res) => {
    try {
      const data = { ...req.body, createdBy: req.session.user.id };
      data.scheduledFor = new Date(data.scheduledFor);
      res.json(await Schedule.create(data));
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  router.delete('/schedule/:id', requireApiOwner, async (req, res) => {
    await Schedule.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  });

  // ===== SETTINGS =====
  router.post('/settings', requireApiOwner, async (req, res) => {
    try {
      for (const [k, v] of Object.entries(req.body)) await BotConfig.set(k, v);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ===== IA TEST =====
  router.post('/ia/test', requireApiOwner, async (req, res) => {
    try {
      const response = await ai.chat(req.body.prompt);
      res.json({ response });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ===== PAYMENTS =====
  router.post('/payments', requireApiAuth, upload.single('receipt'), async (req, res) => {
    try {
      const { plan, amount, method, reference, whatsappNumber, notes } = req.body;
      let receiptUrl = '';
      if (req.file) {
        const r = await new Promise((resolve, reject) => {
          const s = cloudinary.uploader.upload_stream(
            { folder: 'dark-bot/receipts' },
            (err, x) => err ? reject(err) : resolve(x)
          );
          s.end(req.file.buffer);
        });
        receiptUrl = r.secure_url;
      }
      const u = await User.findById(req.session.user.id);
      const p = await Payment.create({
        user: req.session.user.id,
        username: u.username,
        whatsappNumber: whatsappNumber || u.whatsappNumber,
        plan, amount: parseInt(amount), method, reference,
        receipt: receiptUrl, notes,
      });
      // Atualiza WhatsApp do usuário se foi informado
      if (whatsappNumber && !u.whatsappNumber) { u.whatsappNumber = whatsappNumber.replace(/\D/g, ''); await u.save(); }
      // Notifica via Socket.IO
      io.emit('payment:new', { plan, amount, username: u.username });
      res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/payments/:id/approve', requireApiOwner, async (req, res) => {
    try {
      const days = parseInt(req.body.days) || 30;
      const p = await Payment.findById(req.params.id);
      if (!p) return res.status(404).json({ error: 'Não encontrado' });
      p.status = 'aprovado';
      p.approvedAt = new Date();
      p.approvedBy = req.session.user.id;
      await p.save();
      // Promove o usuário
      const u = await User.findById(p.user);
      if (u) {
        u.role = 'premium';
        u.premiumUntil = days > 9999 ? null : new Date(Date.now() + days * 86400000);
        await u.save();
      }
      // Notifica via bot se possível
      try {
        const bot = getBot(io);
        if (bot.sock && p.whatsappNumber) {
          await bot.sock.sendMessage(p.whatsappNumber + '@s.whatsapp.net', {
            text: `🎉 *PAGAMENTO APROVADO*\n\nObrigado! Sua conta foi promovida para *PREMIUM* ⭐\n\n⏳ Válido por ${days >= 9999 ? 'sempre' : days + ' dias'}`,
          });
        }
      } catch (e) {}
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/payments/:id/reject', requireApiOwner, async (req, res) => {
    try {
      const p = await Payment.findById(req.params.id);
      if (!p) return res.status(404).json({ error: 'Não encontrado' });
      p.status = 'rejeitado';
      p.notes = req.body.notes || '';
      await p.save();
      try {
        const bot = getBot(io);
        if (bot.sock && p.whatsappNumber) {
          await bot.sock.sendMessage(p.whatsappNumber + '@s.whatsapp.net', {
            text: `❌ *PAGAMENTO REJEITADO*\n\nMotivo: ${req.body.notes || 'não especificado'}\n\nFale com o Dono.`,
          });
        }
      } catch (e) {}
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ===== BACKUP =====
  router.get('/backup/export', requireApiOwner, async (req, res) => {
    try {
      const data = {
        exportedAt: new Date(),
        commands: await Command.find().lean(),
        users: (await User.find().lean()).map(u => ({ ...u, password: undefined })),
        media: await Media.find().lean(),
        settings: await BotConfig.find().lean(),
        schedules: await Schedule.find().lean(),
      };
      res.setHeader('Content-Disposition', `attachment; filename="dark-bot-backup-${Date.now()}.json"`);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(data, null, 2));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/backup/import', requireApiOwner, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Arquivo obrigatório' });
      const data = JSON.parse(req.file.buffer.toString('utf-8'));
      const overwrite = req.body.overwrite === 'true' || req.body.overwrite === 'on';
      let count = 0;
      if (data.commands) {
        for (const c of data.commands) {
          const { _id, __v, ...rest } = c;
          if (overwrite) await Command.findOneAndUpdate({ name: rest.name }, rest, { upsert: true });
          else await Command.create(rest).catch(()=>{});
          count++;
        }
      }
      if (data.settings) {
        for (const s of data.settings) { await BotConfig.set(s.key, s.value); count++; }
      }
      res.json({ ok: true, imported: count });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/backup/reset', requireApiOwner, async (req, res) => {
    try {
      await Command.deleteMany({});
      await Media.deleteMany({});
      await BotConfig.deleteMany({});
      await Schedule.deleteMany({});
      await Log.deleteMany({});
      // Mantém o dono
      await User.deleteMany({ role: { $ne: 'owner' } });
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });


  // ===== PREFIXOS (multi-prefix) =====
  router.get('/prefixes', requireApiAuth, async (req, res) => {
    const pm = require('../bot/prefixManager');
    res.json({ prefixes: await pm.getPrefixes() });
  });

  router.post('/prefixes', requireApiOwner, async (req, res) => {
    try {
      const pm = require('../bot/prefixManager');
      const { prefixes } = req.body;
      const saved = await pm.setPrefixes(prefixes);
      res.json({ ok: true, prefixes: saved });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });



  // ===== COMMAND OVERRIDES (editar comandos nativos) =====
  router.post('/commands/override/:name', requireApiOwner, async (req, res) => {
    try {
      const name = req.params.name.toLowerCase();
      const data = req.body;
      if (data.aliases && typeof data.aliases === 'string') {
        data.aliases = data.aliases.split(',').map(s => s.trim()).filter(Boolean);
      }
      const updated = await CommandOverride.findOneAndUpdate(
        { commandName: name },
        { ...data, commandName: name },
        { upsert: true, new: true }
      );
      res.json(updated);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/commands/override/:name', requireApiOwner, async (req, res) => {
    try {
      await CommandOverride.deleteOne({ commandName: req.params.name.toLowerCase() });
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ===== GROUPS MANAGEMENT =====
  router.get('/groups/:jid/settings', requireApiOwner, async (req, res) => {
    try {
      const jid = decodeURIComponent(req.params.jid);
      const s = await GroupSettings.findOne({ groupJid: jid });
      res.json(s ? s.toObject() : {});
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/groups/:jid/settings', requireApiOwner, async (req, res) => {
    try {
      const jid = decodeURIComponent(req.params.jid);
      const updated = await GroupSettings.findOneAndUpdate(
        { groupJid: jid },
        { ...req.body, groupJid: jid },
        { upsert: true, new: true }
      );
      res.json(updated);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/groups/:jid/members', requireApiOwner, async (req, res) => {
    try {
      const jid = decodeURIComponent(req.params.jid);
      const bot = getBot(io);
      const meta = await bot.sock.groupMetadata(jid);
      res.json({ members: meta.participants || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/groups/:jid/send', requireApiOwner, async (req, res) => {
    try {
      const jid = decodeURIComponent(req.params.jid);
      const { text, mediaUrl, mediaType } = req.body;
      const bot = getBot(io);
      if (!bot.sock) return res.status(400).json({ error: 'Bot desconectado' });
      if (mediaUrl && mediaType) {
        const buf = await mediaHandler.fetchBuffer(mediaUrl);
        const payload = mediaType === 'image' || mediaType === 'gif' ? { image: buf, caption: text }
          : mediaType === 'video' ? { video: buf, caption: text }
          : mediaType === 'audio' ? { audio: buf, mimetype: 'audio/mp4' }
          : { text };
        await bot.sock.sendMessage(jid, payload);
      } else {
        await bot.sock.sendMessage(jid, { text });
      }
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/groups/:jid/ban', requireApiOwner, async (req, res) => {
    try {
      const jid = decodeURIComponent(req.params.jid);
      const { userJid } = req.body;
      const bot = getBot(io);
      await bot.sock.groupParticipantsUpdate(jid, [userJid], 'remove');
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/groups/:jid/leave', requireApiOwner, async (req, res) => {
    try {
      const jid = decodeURIComponent(req.params.jid);
      const bot = getBot(io);
      await bot.sock.groupLeave(jid);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ===== CONTROL ACTIONS =====
  router.post('/control/restart', requireApiOwner, async (req, res) => {
    res.json({ ok: true, message: 'Reiniciando em 2s...' });
    setTimeout(() => process.exit(0), 2000);
  });

  router.post('/control/reconnect', requireApiOwner, async (req, res) => {
    try {
      const bot = getBot(io);
      bot.start({ mode: 'qr' }).catch(()=>{});
      res.json({ ok: true, message: 'Reconectando...' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/control/clearLogs', requireApiOwner, async (req, res) => {
    try {
      await Log.deleteMany({});
      res.json({ ok: true, message: 'Logs limpos' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/control/clearCache', requireApiOwner, async (req, res) => {
    try {
      require('../bot/prefixManager').clearCache();
      res.json({ ok: true, message: 'Cache limpo' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });



  // ===== VPN DECRYPTER =====
  router.post('/decrypt', requireApiAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

      const user = await User.findById(req.session.user.id);
      if (!user) return res.status(401).json({ error: 'Usuário inválido' });

      const isOwner = user.role === 'owner';
      const isPremium = isOwner || (user.isPremium && user.isPremium());

      if (!isPremium) {
        return res.status(403).json({
          error: '🔒 Recurso Premium! Assine para usar o decrypter.',
          upgrade_url: '/dashboard/subscribe'
        });
      }

      console.log(`[DECRYPT] ${user.username} → ${req.file.originalname} (${req.file.size} bytes)`);

      const result = await decrypter.decrypt(req.file.originalname, req.file.buffer);

      // Log no banco
      try {
        await DecryptLog.create({
          user: user._id,
          username: user.username,
          whatsappNumber: user.whatsappNumber || '',
          fileName: req.file.originalname,
          format: result.format,
          source: 'dashboard',
          success: true,
          extracted: {
            configName: result.configName,
            host: result.server?.host,
            port: result.server?.port,
          },
        });
      } catch (e) { console.warn('Decrypt log:', e.message); }

      res.json(result);
    } catch (err) {
      console.error('[DECRYPT ERROR]', err);
      // Tenta logar o erro também
      try {
        await DecryptLog.create({
          user: req.session.user?.id,
          username: req.session.user?.username || '?',
          fileName: req.file?.originalname || '?',
          source: 'dashboard',
          success: false,
          error: err.message,
        });
      } catch (e) {}
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/decrypt/send-wa', requireApiAuth, async (req, res) => {
    try {
      const { number, data } = req.body;
      if (!number || !data) return res.status(400).json({ error: 'Dados faltando' });
      const bot = getBot(io);
      if (!bot.sock || bot.getStatus().status !== 'connected') {
        return res.status(400).json({ error: 'Bot não está conectado ao WhatsApp' });
      }
      const formatted = formatForWhatsApp(data, config);
      const jid = number.replace(/\D/g, '') + '@s.whatsapp.net';
      if (formatted.length > 4000) {
        for (let i = 0; i < formatted.length; i += 3800) {
          await bot.sock.sendMessage(jid, { text: formatted.slice(i, i + 3800) });
        }
      } else {
        await bot.sock.sendMessage(jid, { text: formatted });
      }
      const jsonBuf = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
      await bot.sock.sendMessage(jid, {
        document: jsonBuf,
        fileName: (data.fileName || 'config') + '.json',
        mimetype: 'application/json',
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/decrypt/logs', requireApiAuth, async (req, res) => {
    try {
      const user = await User.findById(req.session.user.id);
      const filter = user?.role === 'owner' ? {} : { user: user?._id };
      res.json(await DecryptLog.find(filter).sort({ createdAt: -1 }).limit(100));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });


  return router;
};
