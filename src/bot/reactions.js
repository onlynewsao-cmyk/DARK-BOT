/**
 * Sistema de reações automáticas por categoria de comando
 */

// Emojis de "processando" por categoria
const PROCESSING = {
  audio: '🎵', music: '🎵', play: '🎵', spotify: '🎵', soundcloud: '🎵',
  video: '🎬', tiktok: '🎬', instagram: '📸', fb: '📘', twitter: '🐦', pinterest: '📌',
  sticker: '🎨', s: '🎨', fig: '🎨', attp: '✨', ttp: '✨', toimg: '🖼️', figura: '🎨',
  ia: '🧠', gpt: '🧠', chatgpt: '🧠', ai: '🧠', llm: '🧠', imagem: '🎨', img: '🎨',
  decrypt: '🔓', vpn: '🔓', dec: '🔓', vpndec: '🔓',
  download: '📥', dl: '📥',
  ban: '🚫', kick: '🚫', promote: '👑', demote: '⬇️',
  forca: '🎮', quiz: '🧠', adivinha: '🎯', blackjack: '🎴', russa: '🔫',
  trabalhar: '💼', crime: '🦹', roubar: '🦹', daily: '🎁', apostar: '🎰',
  comprar: '🛒', loja: '🏪', transferir: '💸', depositar: '🏦', sacar: '🏦',
  broadcast: '📢', send: '📤', sendgroup: '📤',
  todos: '📢', hidetag: '📢',
  clima: '🌤️', translate: '🌐', qrcode: '📱', calc: '🧮',
  casar: '💍', divorciar: '💔', adotar: '👶',
};

// Emojis de sucesso
const SUCCESS = '✅';
const ERROR = '❌';
const WAIT = '⏳';

function getProcessingEmoji(commandName) {
  if (!commandName) return WAIT;
  return PROCESSING[commandName.toLowerCase()] || WAIT;
}

function getSuccessEmoji(commandName) {
  return SUCCESS;
}

function getErrorEmoji(commandName) {
  return ERROR;
}

/**
 * Reage à mensagem com emoji apropriado
 */
async function react(sock, msg, emoji) {
  try {
    await sock.sendMessage(msg.key.remoteJid, {
      react: { text: emoji, key: msg.key }
    });
  } catch (e) { /* ignora */ }
}

async function reactStart(sock, msg, commandName) {
  await react(sock, msg, getProcessingEmoji(commandName));
}

async function reactSuccess(sock, msg, commandName) {
  await react(sock, msg, getSuccessEmoji(commandName));
}

async function reactError(sock, msg, commandName) {
  await react(sock, msg, getErrorEmoji(commandName));
}

async function reactClear(sock, msg) {
  // Limpa a reação
  try {
    await sock.sendMessage(msg.key.remoteJid, {
      react: { text: '', key: msg.key }
    });
  } catch (e) {}
}

module.exports = {
  react, reactStart, reactSuccess, reactError, reactClear,
  getProcessingEmoji, getSuccessEmoji, getErrorEmoji,
  PROCESSING, SUCCESS, ERROR, WAIT,
};
