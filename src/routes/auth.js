const express = require('express');
const router = express.Router();
const User = require('../database/models/User');
const config = require('../config');

router.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.redirect('/login');
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
  res.render('auth/register', { title: 'Cadastro', error: null });
});

router.post('/register', async (req, res) => {
  const { username, password, name, whatsappNumber } = req.body;
  try {
    if (!username || !password) {
      return res.render('auth/register', { title: 'Cadastro', error: 'Preencha todos os campos' });
    }
    const exists = await User.findOne({ username: username.toLowerCase().trim() });
    if (exists) {
      return res.render('auth/register', { title: 'Cadastro', error: 'Usuário já existe' });
    }
    await User.create({
      username: username.toLowerCase().trim(),
      password,
      name: name || username,
      whatsappNumber: (whatsappNumber || '').replace(/\D/g, ''),
      role: 'free',
    });
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    res.render('auth/register', { title: 'Cadastro', error: 'Erro no cadastro: ' + err.message });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
