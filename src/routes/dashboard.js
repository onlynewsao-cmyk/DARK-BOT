const express = require('express');
const router = express.Router();
const { requireLogin, requireOwner } = require('../middleware/auth');
const User = require('../database/models/User');
const Command = require('../database/models/Command');
const Media = require('../database/models/Media');
const { getBot } = require('../bot/whatsapp');

router.use(requireLogin);

// Home do dashboard
router.get('/', async (req, res) => {
  const bot = getBot();
  const stats = {
    botStatus: bot.getStatus().status,
    totalUsers: await User.countDocuments().catch(() => 0),
    premiumUsers: await User.countDocuments({ role: 'premium' }).catch(() => 0),
    totalCommands: await Command.countDocuments().catch(() => 0),
    totalMedia: await Media.countDocuments().catch(() => 0),
  };
  res.render('dashboard/home', { title: 'Dashboard', stats });
});

// Conexão do bot (apenas dono)
router.get('/connect', requireOwner, (req, res) => {
  const bot = getBot();
  res.render('dashboard/connect', { title: 'Conectar Bot', botState: bot.getStatus() });
});

// Comandos (apenas dono pode editar)
router.get('/commands', requireOwner, async (req, res) => {
  const commands = await Command.find().sort({ category: 1, name: 1 });
  res.render('dashboard/commands', { title: 'Comandos', commands });
});

router.get('/commands/new', requireOwner, async (req, res) => {
  const medias = await Media.find().sort({ createdAt: -1 }).limit(50);
  res.render('dashboard/command-edit', { title: 'Novo Comando', cmd: null, medias });
});

router.get('/commands/:id/edit', requireOwner, async (req, res) => {
  const cmd = await Command.findById(req.params.id);
  if (!cmd) return res.redirect('/dashboard/commands');
  const medias = await Media.find().sort({ createdAt: -1 }).limit(50);
  res.render('dashboard/command-edit', { title: 'Editar Comando', cmd, medias });
});

// Mídias (apenas dono)
router.get('/media', requireOwner, async (req, res) => {
  const medias = await Media.find().sort({ createdAt: -1 });
  res.render('dashboard/media', { title: 'Mídias', medias });
});

// Usuários (apenas dono)
router.get('/users', requireOwner, async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.render('dashboard/users', { title: 'Usuários', users });
});

// Perfil do usuário (todos)
router.get('/profile', async (req, res) => {
  const user = await User.findById(req.session.user.id);
  res.render('dashboard/profile', { title: 'Meu Perfil', userData: user });
});

module.exports = router;
