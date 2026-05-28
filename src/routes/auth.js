const express = require('express');
const router = express.Router();
const User = require('../database/models/User');
const config = require('../config');

// Landing page bonita (ou redireciona pro dashboard se logado)
router.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('landing', { title: 'Bem-vindo' });
});

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'Login', error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username: (username || '').toLowerCase().trim() });
    if (!user || !user.active) {
      return res.render('auth/login', { title: 'Login', error: 'Usuário ou senha inválidos' });
    }
    const ok = await user.comparePassword(password);
    if (!ok) {
      return res.render('auth/login', { title: 'Login', error: 'Usuário ou senha inválidos' });
    }
    user.lastLogin = new Date();
    await user.save();
    req.session.user = {
      id: user._id.toString(),
      username: user.username,
      name: user.name,
      role: user.role,
      whatsappNumber: user.whatsappNumber,
    };
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.render('auth/login', { title: 'Login', error: 'Erro no servidor' });
  }
});

router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/register', { title: 'Cadastro', error: null });
});

router.post('/register', async (req, res) => {
  const { username, password, name, whatsappNumber } = req.body;
  try {
    if (!username || !password) {
      return res.render('auth/register', { title: 'Cadastro', error: 'Preencha todos os campos' });
    }
    const userManager = require('../bot/userManager');
    const cleanNum = (whatsappNumber || '').replace(/\D/g, '');

    // Se forneceu número, checa se já existe usuário com esse número
    if (cleanNum) {
      const existingByNumber = await User.findOne({ whatsappNumber: cleanNum });
      if (existingByNumber) {
        if (existingByNumber.autoCreated) {
          // Bot já criou conta para esse número via WhatsApp — vincula
          existingByNumber.username = username.toLowerCase().trim();
          existingByNumber.password = password;
          if (name) existingByNumber.name = name;
          existingByNumber.autoCreated = false;
          await existingByNumber.save();
          return res.redirect('/login?msg=' + encodeURIComponent('Conta vinculada! Use seu usuário para entrar'));
        }
        return res.render('auth/register', { title: 'Cadastro', error: 'Já existe conta para esse WhatsApp. Faça login!' });
      }
    }

    const exists = await User.findOne({ username: username.toLowerCase().trim() });
    if (exists) {
      return res.render('auth/register', { title: 'Cadastro', error: 'Username já existe' });
    }

    await User.create({
      username: username.toLowerCase().trim(),
      password,
      name: name || username,
      whatsappNumber: cleanNum,
      role: 'free',
    });
    res.redirect('/login?msg=' + encodeURIComponent('Conta criada! Faça login'));
  } catch (err) {
    console.error(err);
    res.render('auth/register', { title: 'Cadastro', error: 'Erro no cadastro: ' + err.message });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
