const express = require('express');
const router = express.Router();
const { requireLogin, requireOwner } = require('../middleware/auth');
const User = require('../database/models/User');
const Command = require('../database/models/Command');
const Media = require('../database/models/Media');
const BotConfig = require('../database/models/BotConfig');
const Schedule = require('../database/models/Schedule');
const Payment = require('../database/models/Payment');
const Log = require('../database/models/Log');
const DecryptLog = require('../database/models/DecryptLog');
const CommandOverride = require('../database/models/CommandOverride');
const GroupSettings = require('../database/models/GroupSettings');
const { getBot } = require('../bot/whatsapp');
const catalog = require('../bot/commandCatalog');

router.use(requireLogin);

router.get('/', async (req, res) => {
  const bot = getBot();
  const botState = bot.getStatus();
  const stats = {
    botStatus: botState.status,
    totalUsers: await User.countDocuments().catch(() => 0),
    premiumUsers: await User.countDocuments({ role: 'premium' }).catch(() => 0),
    totalCommands: await Command.countDocuments().catch(() => 0),
    totalMedia: await Media.countDocuments().catch(() => 0),
    messageCount: botState.messageCount || 0,
  };
  res.render('dashboard/home', { title: 'Dashboard', stats });
});

router.get('/connect', requireOwner, (req, res) => res.render('dashboard/connect', { title: 'Conectar Bot', botState: getBot().getStatus() }));
router.get('/console', requireOwner, (req, res) => res.render('dashboard/console', { title: 'Console Live', botState: getBot().getStatus() }));

// ===== CONTROL PANEL =====
router.get('/control', requireOwner, async (req, res) => {
  const all = await BotConfig.find().catch(() => []);
  const settings = {};
  all.forEach(c => { settings[c.key] = c.value; });
  const envStatus = {
    groq: !!process.env.GROQ_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    appUrl: process.env.APP_URL || 'não configurado',
  };
  res.render('dashboard/control', { title: 'Painel de Controle', settings, botState: getBot().getStatus(), envStatus });
});

router.get('/broadcast', requireOwner, async (req, res) => {
  const medias = await Media.find().sort({ createdAt: -1 }).limit(100).catch(() => []);
  res.render('dashboard/broadcast', { title: 'Broadcast', medias });
});

router.get('/schedule', requireOwner, async (req, res) => {
  const schedules = await Schedule.find().sort({ scheduledFor: 1 }).catch(() => []);
  const medias = await Media.find().sort({ createdAt: -1 }).limit(100).catch(() => []);
  res.render('dashboard/schedule', { title: 'Agendamentos', schedules, medias });
});

router.get('/settings', requireOwner, async (req, res) => {
  const all = await BotConfig.find().catch(() => []);
  const settings = {};
  all.forEach(c => { settings[c.key] = c.value; });
  const prefixManager = require('../bot/prefixManager');
  const prefixes = await prefixManager.getPrefixes();
  res.render('dashboard/settings', { title: 'Configurações', settings, prefixes });
});

router.get('/ia', requireOwner, async (req, res) => {
  const all = await BotConfig.find().catch(() => []);
  const settings = {};
  all.forEach(c => { settings[c.key] = c.value; });
  res.render('dashboard/ia', { title: 'IA', settings });
});

// ===== COMMANDS EDITOR =====
router.get('/commands', requireOwner, async (req, res) => {
  const customCommands = await Command.find().sort({ category: 1, name: 1 });
  const medias = await Media.find().sort({ createdAt: -1 }).limit(200).catch(() => []);
  const overridesArr = await CommandOverride.find().catch(() => []);
  const overrides = {};
  overridesArr.forEach(o => { overrides[o.commandName] = o.toObject(); });
  // Catalog agrupado por categoria
  const catGrouped = {};
  for (const cmd of catalog.getAll()) {
    if (!catGrouped[cmd.category]) catGrouped[cmd.category] = [];
    catGrouped[cmd.category].push(cmd);
  }
  const totalCount = catalog.getAll().length + customCommands.length;
  res.render('dashboard/commands', {
    title: 'Comandos', commands: customCommands, customCommands,
    medias, overrides, catalog: catGrouped, categories: catalog.getCategories(),
    totalCount,
  });
});

router.get('/commands/new', requireOwner, async (req, res) => {
  const medias = await Media.find().sort({ createdAt: -1 }).limit(100).catch(() => []);
  res.render('dashboard/command-edit', { title: 'Novo Comando', cmd: null, medias });
});

router.get('/commands/:id/edit', requireOwner, async (req, res) => {
  const cmd = await Command.findById(req.params.id);
  if (!cmd) return res.redirect('/dashboard/commands');
  const medias = await Media.find().sort({ createdAt: -1 }).limit(100).catch(() => []);
  res.render('dashboard/command-edit', { title: 'Editar', cmd, medias });
});

router.get('/media', requireOwner, async (req, res) => res.render('dashboard/media', { title: 'Mídias', medias: await Media.find().sort({ createdAt: -1 }) }));
router.get('/users', requireOwner, async (req, res) => res.render('dashboard/users', { title: 'Usuários', users: await User.find().sort({ createdAt: -1 }) }));

// ===== GROUPS =====
router.get('/groups', requireOwner, async (req, res) => {
  let groups = [];
  try {
    const bot = getBot();
    if (bot.sock && bot.getStatus().status === 'connected') {
      const all = await bot.sock.groupFetchAllParticipating();
      groups = Object.values(all);
    }
  } catch (e) { console.error('groups fetch:', e); }

  const settingsArr = await GroupSettings.find().catch(() => []);
  const settingsMap = {};
  settingsArr.forEach(s => { settingsMap[s.groupJid] = s.toObject(); });

  const medias = await Media.find().sort({ createdAt: -1 }).limit(100).catch(() => []);
  res.render('dashboard/groups', { title: 'Grupos', groups, settingsMap, medias });
});

router.get('/payments', requireOwner, async (req, res) => {
  const payments = await Payment.find().sort({ createdAt: -1 }).limit(200);
  const all = await Payment.find();
  const stats = {
    pending: all.filter(p => p.status === 'pendente').length,
    approved: all.filter(p => p.status === 'aprovado').length,
    rejected: all.filter(p => p.status === 'rejeitado').length,
    totalRevenue: all.filter(p => p.status === 'aprovado').reduce((s,p) => s + (p.amount||0), 0),
  };
  res.render('dashboard/payments', { title: 'Pagamentos', payments, stats });
});

router.get('/stats', requireOwner, async (req, res) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7*86400000);
  const monthAgo = new Date(now.getTime() - 30*86400000);
  const stats = {
    today: await Log.countDocuments({ createdAt: { $gte: today } }).catch(()=>0),
    week: await Log.countDocuments({ createdAt: { $gte: weekAgo } }).catch(()=>0),
    month: await Log.countDocuments({ createdAt: { $gte: monthAgo } }).catch(()=>0),
    total: await Log.countDocuments().catch(()=>0),
  };
  const topCommands = await Log.aggregate([
    { $match: { command: { $ne: '' } } },
    { $group: { _id: '$command', count: { $sum: 1 } } },
    { $sort: { count: -1 } }, { $limit: 10 },
  ]).catch(()=>[]);
  const topUsers = await Log.aggregate([
    { $match: { user: { $ne: '' } } },
    { $group: { _id: '$user', count: { $sum: 1 } } },
    { $sort: { count: -1 } }, { $limit: 10 },
  ]).catch(()=>[]);
  const daysData = await Log.aggregate([
    { $match: { createdAt: { $gte: new Date(now.getTime() - 14*86400000) } } },
    { $group: { _id: { $dateToString: { format: '%d/%m', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).catch(()=>[]);
  res.render('dashboard/stats', { title: 'Estatísticas', stats, topCommands, topUsers, daysData });
});

router.get('/backup', requireOwner, (req, res) => res.render('dashboard/backup', { title: 'Backup' }));

router.get('/decrypter', async (req, res) => {
  const userData = await User.findById(req.session.user.id);
  const isPremium = userData?.role === 'owner' || (userData && userData.isPremium());
  const filter = userData?.role === 'owner' ? {} : { user: userData?._id };
  const logs = await DecryptLog.find(filter).sort({ createdAt: -1 }).limit(50).catch(()=>[]);
  res.render('dashboard/decrypter', { title: 'VPN Decrypter', logs, isPremium });
});

router.get('/profile', async (req, res) => {
  const user = await User.findById(req.session.user.id);
  res.render('dashboard/profile', { title: 'Meu Perfil', userData: user });
});

router.get('/subscribe', async (req, res) => {
  const userData = await User.findById(req.session.user.id);
  const myPayment = await Payment.findOne({ user: req.session.user.id }).sort({ createdAt: -1 });
  res.render('dashboard/subscribe', { title: 'Assinar Premium', userData, myPayment });
});

module.exports = router;
