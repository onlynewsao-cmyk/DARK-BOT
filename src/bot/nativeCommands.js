const Command = require('../database/models/Command');
const User = require('../database/models/User');
const Schedule = require('../database/models/Schedule');
const Payment = require('../database/models/Payment');
const Log = require('../database/models/Log');
const BotConfig = require('../database/models/BotConfig');
const mediaHandler = require('./mediaHandler');
const downloader = require('./downloader');
const stickerMaker = require('./stickerMaker');
const ai = require('./ai');
const config = require('../config');
const menuBuilder = require('./menuBuilder');
const os = require('os');

const startTime = Date.now();

const reply = (sock, msg, ctx, text) => sock.sendMessage(ctx.remoteJid, { text }, { quoted: msg });
const react = (sock, msg, emoji) => sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } });

// Normaliza JID removendo sufixos como ":XX" usados pelo WhatsApp
function normalizeJid(jid) {
  if (!jid) return '';
  const num = jid.split('@')[0].split(':')[0];
  const domain = jid.includes('@') ? jid.split('@')[1].split(':')[0] : 's.whatsapp.net';
  return num + '@' + domain;
}
function jidNumber(jid) {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0];
}

async function isAdmin(sock, ctx) {
  if (!ctx.isGroup) return false;
  try {
    const meta = ctx.groupMeta || (await sock.groupMetadata(ctx.remoteJid));
    const senderNum = jidNumber(ctx.senderJid);
    const p = meta.participants.find(x => jidNumber(x.id) === senderNum);
    return p?.admin === 'admin' || p?.admin === 'superadmin';
  } catch { return false; }
}
async function botIsAdmin(sock, ctx) {
  if (!ctx.isGroup) return false;
  try {
    const meta = ctx.groupMeta || (await sock.groupMetadata(ctx.remoteJid));
    const myJid = sock.user?.id || sock.user?.lid || '';
    const myNum = jidNumber(myJid);
    // Pega TODOS os JIDs possíveis do bot (normal + lid)
    const myJids = [myNum];
    if (sock.user?.lid) myJids.push(jidNumber(sock.user.lid));
    // Busca por qualquer correspondência
    const p = meta.participants.find(x => myJids.includes(jidNumber(x.id)));
    return p?.admin === 'admin' || p?.admin === 'superadmin';
  } catch (e) {
    console.error('botIsAdmin err:', e);
    return false;
  }
}
function getMentions(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}
function formatUptime(ms) {
  const s = Math.floor(ms/1000);
  const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60);
  return `${d}d ${h}h ${m}m ${s%60}s`;
}
async function logCmd(name, ctx, success = true) {
  try {
    await Log.create({
      type: 'command', command: name, user: ctx.pushName,
      number: ctx.senderNumber, group: ctx.groupName || '', groupJid: ctx.isGroup ? ctx.remoteJid : '',
      success,
    });
  } catch (e) {}
}

module.exports = {
  // ============ INFO ============
  async menu({ sock, msg, ctx, config }) {
    const Command = require('../database/models/Command');
    const User = require('../database/models/User');
    const prefixManager = require('./prefixManager');

    const totalUsers = await User.countDocuments().catch(() => 0);
    let totalGroups = 0;
    try {
      const groups = await sock.groupFetchAllParticipating();
      totalGroups = Object.keys(groups).length;
    } catch (e) {}

    const user = await User.findOne({ whatsappNumber: ctx.senderNumber }).catch(() => null);
    const role = user?.role || (ctx.senderNumber === config.owner.number ? 'owner' : 'free');
    const prefixes = await prefixManager.getPrefixes();

    const menu = menuBuilder.buildMainMenu({
      ctx, config,
      stats: { totalUsers, totalGroups, role, startTime },
      prefixes,
    });

    await reply(sock, msg, ctx, menu);
    logCmd('menu', ctx);
  },

  async ping({ sock, msg, ctx, config }) {
    const t = Date.now();
    const sent = await reply(sock, msg, ctx, '🏓 Calculando...');
    await sock.sendMessage(ctx.remoteJid, {
      text: `🏓 *Pong!*\n\n⚡ Latência: *${Date.now()-t}ms*\n🤖 ${config.bot.name} ativo!`,
      edit: sent.key,
    }).catch(() => reply(sock, msg, ctx, `🏓 ${Date.now()-t}ms`));
    logCmd('ping', ctx);
  },

  async dono({ sock, msg, ctx, config }) {
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${config.owner.name}\nORG:${config.bot.name};\nTEL;type=CELL;type=VOICE;waid=${config.owner.number}:+${config.owner.number}\nEND:VCARD`;
    await sock.sendMessage(ctx.remoteJid, { contacts: { displayName: config.owner.name, contacts: [{ vcard }] } }, { quoted: msg });
    await reply(sock, msg, ctx, `👑 *DONO:* ${config.owner.name}\n📞 wa.me/${config.owner.number}\n🌙 _The Dark Side_`);
    logCmd('dono', ctx);
  },

  async info({ sock, msg, ctx, config }) {
    const ram = `${Math.round(process.memoryUsage().heapUsed/1024/1024)}MB`;
    const text = `╭━━〔 *${config.bot.name}* 〕━━╮
│ 🤖 Bot: ${config.bot.name}
│ 👑 Dono: ${config.owner.name}
│ 📞 +${config.owner.number}
│ 🌐 Node: ${process.version}
│ 💾 RAM: ${ram}
│ ⏱️ Uptime: ${formatUptime(Date.now()-startTime)}
│ 🖥️ ${os.platform()} ${os.arch()}
╰━━━━━━━━━━━━━━━━╯`;
    return reply(sock, msg, ctx, text);
  },

  async id({ sock, msg, ctx }) {
    return reply(sock, msg, ctx, `🆔 *INFORMAÇÕES*\n\n👤 Você: ${ctx.senderNumber}\n💬 Chat: ${ctx.remoteJid}\n${ctx.isGroup ? '👥 Grupo: ' + ctx.groupName : '📱 Privado'}`);
  },

  async perfil({ sock, msg, ctx }) {
    const user = await User.findOne({ whatsappNumber: ctx.senderNumber });
    const role = user?.role === 'owner' ? '👑 Dono' : user?.role === 'premium' ? '⭐ Premium' : '🆓 Free';
    return reply(sock, msg, ctx, `╭━〔 👤 *SEU PERFIL* 〕━╮
│ 📛 ${ctx.pushName}
│ 📱 +${ctx.senderNumber}
│ 🏷️ ${role}
│ ⚡ ${user?.commandsUsed || 0} cmds usados
${user?.premiumUntil ? `│ ⏳ Premium até ${new Date(user.premiumUntil).toLocaleDateString('pt-BR')}` : ''}
╰━━━━━━━━━━━━━━━╯`);
  },

  // ============ IA ============
  async ia({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '🧠 Use: !ia <sua pergunta>');
    await react(sock, msg, '🤔');
    try {
      const answer = await ai.chat(args.join(' '));
      await react(sock, msg, '✅');
      return reply(sock, msg, ctx, `🧠 *IA responde:*\n\n${answer}`);
    } catch (e) {
      await react(sock, msg, '❌');
      return reply(sock, msg, ctx, '❌ ' + e.message);
    }
  },

  async gpt(args) { return module.exports.ia(args); },

  async imagem({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '🎨 Use: !imagem <descrição>');
    await react(sock, msg, '🎨');
    try {
      const buf = await ai.generateImage(args.join(' '));
      await sock.sendMessage(ctx.remoteJid, { image: buf, caption: `🎨 ${args.join(' ')}` }, { quoted: msg });
      await react(sock, msg, '✅');
    } catch (e) {
      await react(sock, msg, '❌');
      return reply(sock, msg, ctx, '❌ ' + e.message);
    }
  },

  async figura({ sock, msg, ctx, args, config }) {
    if (!args.length) return reply(sock, msg, ctx, '✨ Use: !figura <descrição>');
    await react(sock, msg, '🎨');
    try {
      const buf = await ai.generateImage(args.join(' '));
      const stk = await stickerMaker.create(buf, {
        botName: config.bot.name, ownerName: config.owner.name,
        userName: ctx.pushName, groupName: ctx.groupName || 'Privado', isVideo: false,
      });
      await sock.sendMessage(ctx.remoteJid, { sticker: stk }, { quoted: msg });
      await react(sock, msg, '✅');
    } catch (e) {
      await react(sock, msg, '❌');
      return reply(sock, msg, ctx, '❌ ' + e.message);
    }
  },

  // ============ DOWNLOADS ============
  async play({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '🎵 Use: !play <música ou link>');
    await react(sock, msg, '🎵');
    try {
      let result;
      try {
        result = await downloader.youtubeAudio(args.join(' '));
        const buf = await mediaHandler.fetchBuffer(result.url, 60000);
        await sock.sendMessage(ctx.remoteJid, {
          audio: buf, mimetype: 'audio/mpeg', fileName: `${result.title}.mp3`,
        }, { quoted: msg });
      } catch (e1) {
        // Fallback silencioso pra ytdl direto
        const r2 = await downloader.youtubeAudioBuffer(args.join(' '));
        await sock.sendMessage(ctx.remoteJid, {
          audio: r2.buffer, mimetype: 'audio/mp4', fileName: `${r2.title}.mp3`,
        }, { quoted: msg });
      }
      await react(sock, msg, '✅');
      logCmd('play', ctx);
    } catch (e) {
      await react(sock, msg, '❌');
      return reply(sock, msg, ctx, '❌ ' + e.message);
    }
  },

  async play2({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '🎵 Use: !play2 <música> _(alta qualidade)_');
    await react(sock, msg, '🎵');
    try {
      const result = await downloader.youtubeAudioHD(args.join(' '));
      const buf = await mediaHandler.fetchBuffer(result.url, 90000);
      await sock.sendMessage(ctx.remoteJid, {
        audio: buf, mimetype: 'audio/mpeg', fileName: `${result.title}-HD.mp3`,
      }, { quoted: msg });
      await react(sock, msg, '✅');
      logCmd('play2', ctx);
    } catch (e) {
      await react(sock, msg, '❌');
      return reply(sock, msg, ctx, '❌ ' + e.message);
    }
  },

  async video({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '🎬 Use: !video <nome/link>');
    await react(sock, msg, '🎬');
    try {
      const r = await downloader.youtubeVideo(args.join(' '));
      const buf = await mediaHandler.fetchBuffer(r.url, 120000);
      const sizeMB = (buf.length / 1024 / 1024).toFixed(1);
      if (buf.length > 90 * 1024 * 1024) {
        await react(sock, msg, ctx, '⚠️');
        return reply(sock, msg, ctx, `❌ Vídeo muito grande (${sizeMB}MB). Use: !video2 ${args.join(' ')}`);
      }
      await sock.sendMessage(ctx.remoteJid, {
        video: buf, mimetype: 'video/mp4',
        caption: `🎬 *${r.title}*`,
        fileName: `${r.title}.mp4`,
      }, { quoted: msg });
      await react(sock, msg, '✅');
      logCmd('video', ctx);
    } catch (e) {
      await react(sock, msg, '❌');
      return reply(sock, msg, ctx, '❌ ' + e.message);
    }
  },

  async video2({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '🎬 Use: !video2 <nome/link> _(qualidade baixa)_');
    await react(sock, msg, '🎬');
    try {
      const r = await downloader.youtubeVideoLow(args.join(' '));
      const buf = await mediaHandler.fetchBuffer(r.url, 60000);
      await sock.sendMessage(ctx.remoteJid, {
        video: buf, mimetype: 'video/mp4',
        caption: `🎬 *${r.title}*`,
        fileName: `${r.title}.mp4`,
      }, { quoted: msg });
      await react(sock, msg, '✅');
      logCmd('video2', ctx);
    } catch (e) {
      await react(sock, msg, '❌');
      return reply(sock, msg, ctx, '❌ ' + e.message);
    }
  },

  async tiktok({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '🎵 Use: !tiktok <link>');
    await react(sock, msg, '🎵');
    try {
      const r = await downloader.tiktok(args[0]);
      const buf = await mediaHandler.fetchBuffer(r.url, 60000);
      await sock.sendMessage(ctx.remoteJid, {
        video: buf, mimetype: 'video/mp4',
        caption: `🎵 ${r.title || 'TikTok'}`,
      }, { quoted: msg });
      await react(sock, msg, '✅');
      logCmd('tiktok', ctx);
    } catch (e) { await react(sock, msg, '❌'); return reply(sock, msg, ctx, '❌ ' + e.message); }
  },

  async instagram({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '📸 Use: !instagram <link>');
    await react(sock, msg, '📸');
    try {
      const r = await downloader.instagram(args[0]);
      const buf = await mediaHandler.fetchBuffer(r.url, 60000);
      const payload = r.type === 'video'
        ? { video: buf, mimetype: 'video/mp4', caption: '📸 Instagram' }
        : { image: buf, caption: '📸 Instagram' };
      await sock.sendMessage(ctx.remoteJid, payload, { quoted: msg });
      await react(sock, msg, '✅');
      logCmd('instagram', ctx);
    } catch (e) {
      await react(sock, msg, '❌');
      return reply(sock, msg, ctx, '❌ Instagram temporariamente indisponível (APIs públicas instáveis).\nTente: !pinterest ou cole o link direto');
    }
  },

  async fb({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '📘 Use: !fb <link>');
    await react(sock, msg, '📘');
    try {
      const r = await downloader.facebook(args[0]);
      const buf = await mediaHandler.fetchBuffer(r.url, 60000);
      await sock.sendMessage(ctx.remoteJid, {
        video: buf, mimetype: 'video/mp4',
        caption: `📘 ${r.title || 'Facebook'}`,
      }, { quoted: msg });
      await react(sock, msg, '✅');
      logCmd('fb', ctx);
    } catch (e) { await react(sock, msg, '❌'); return reply(sock, msg, ctx, '❌ ' + e.message); }
  },

  async twitter({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '🐦 Use: !twitter <link>');
    await react(sock, msg, '🐦');
    try {
      const r = await downloader.twitter(args[0]);
      const buf = await mediaHandler.fetchBuffer(r.url, 60000);
      await sock.sendMessage(ctx.remoteJid, {
        video: buf, mimetype: 'video/mp4', caption: '🐦 X / Twitter',
      }, { quoted: msg });
      await react(sock, msg, '✅');
      logCmd('twitter', ctx);
    } catch (e) {
      await react(sock, msg, '❌');
      return reply(sock, msg, ctx, '❌ Twitter/X temporariamente indisponível (APIs públicas instáveis).');
    }
  },

  async spotify({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '🎧 Use: !spotify <link>');
    await react(sock, msg, '🎧');
    try {
      const r = await downloader.spotify(args[0]);
      const buf = await mediaHandler.fetchBuffer(r.url, 90000);
      await sock.sendMessage(ctx.remoteJid, {
        audio: buf, mimetype: 'audio/mpeg', fileName: `${r.title}.mp3`,
      }, { quoted: msg });
      await react(sock, msg, '✅');
      logCmd('spotify', ctx);
    } catch (e) {
      await react(sock, msg, '❌');
      return reply(sock, msg, ctx, '❌ Spotify indisponível. Use !play <nome da música> como alternativa.');
    }
  },

  async soundcloud({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '☁️ Use: !soundcloud <link>');
    await react(sock, msg, '☁️');
    try {
      const r = await downloader.soundcloud(args[0]);
      const buf = await mediaHandler.fetchBuffer(r.url, 90000);
      await sock.sendMessage(ctx.remoteJid, {
        audio: buf, mimetype: 'audio/mpeg', fileName: `${r.title}.mp3`,
      }, { quoted: msg });
      await react(sock, msg, '✅');
      logCmd('soundcloud', ctx);
    } catch (e) {
      await react(sock, msg, '❌');
      return reply(sock, msg, ctx, '❌ SoundCloud indisponível. Use !play como alternativa.');
    }
  },

  async pinterest({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '📌 Use: !pinterest <link OU busca>');
    await react(sock, msg, '📌');
    try {
      const isUrl = /^https?:\/\//.test(args[0]);
      const r = isUrl ? await downloader.pinterest(args[0]) : await downloader.pinterestSearch(args.join(' '));
      const buf = await mediaHandler.fetchBuffer(r.url, 60000);
      // Detecta se é vídeo ou imagem pelo URL
      const isVideo = r.url.includes('.mp4') || r.url.includes('/video/');
      const payload = isVideo
        ? { video: buf, mimetype: 'video/mp4', caption: '📌 Pinterest' }
        : { image: buf, caption: '📌 Pinterest' };
      await sock.sendMessage(ctx.remoteJid, payload, { quoted: msg });
      await react(sock, msg, '✅');
      logCmd('pinterest', ctx);
    } catch (e) {
      await react(sock, msg, '❌');
      return reply(sock, msg, ctx, '❌ ' + e.message);
    }
  },

  async threads({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '🧵 Use: !threads <link>');
    await react(sock, msg, '🧵');
    try {
      const r = await downloader.threads(args[0]);
      const buf = await mediaHandler.fetchBuffer(r.url, 60000);
      const payload = r.type === 'video'
        ? { video: buf, mimetype: 'video/mp4', caption: '🧵 Threads' }
        : { image: buf, caption: '🧵 Threads' };
      await sock.sendMessage(ctx.remoteJid, payload, { quoted: msg });
      await react(sock, msg, '✅');
      logCmd('threads', ctx);
    } catch (e) {
      await react(sock, msg, '❌');
      return reply(sock, msg, ctx, '❌ ' + e.message);
    }
  },

  // ============ STICKER ============
  async sticker({ sock, msg, ctx, config }) {
    const isMedia = msg.message?.imageMessage || msg.message?.videoMessage;
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedMedia = quoted?.imageMessage || quoted?.videoMessage;
    if (!isMedia && !quotedMedia) return reply(sock, msg, ctx, '🎨 Envie/responda foto ou vídeo com *!sticker*');
    await react(sock, msg, '⏳');
    try {
      const buffer = await mediaHandler.downloadFromMessage(quotedMedia ? { message: quoted } : msg);
      const stk = await stickerMaker.create(buffer, {
        botName: config.bot.name, ownerName: config.owner.name,
        userName: ctx.pushName, groupName: ctx.groupName || 'Privado',
        isVideo: !!(msg.message?.videoMessage || quoted?.videoMessage),
      });
      await sock.sendMessage(ctx.remoteJid, { sticker: stk }, { quoted: msg });
      await react(sock, msg, '✅');
    } catch (e) { await react(sock, msg, '❌'); return reply(sock, msg, ctx, '❌ ' + e.message); }
  },

  async toimg({ sock, msg, ctx }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted?.stickerMessage) return reply(sock, msg, ctx, '🖼️ Responda um sticker');
    try {
      const buf = await mediaHandler.downloadFromMessage({ message: quoted });
      await sock.sendMessage(ctx.remoteJid, { image: buf, caption: '🖼️ Sticker → Imagem' }, { quoted: msg });
    } catch (e) { return reply(sock, msg, ctx, '❌ ' + e.message); }
  },

  async attp({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '✍️ Use: !attp <texto>');
    try {
      const buf = await mediaHandler.fetchBuffer(`https://api.popcat.xyz/attp?text=${encodeURIComponent(args.join(' '))}`);
      await sock.sendMessage(ctx.remoteJid, { sticker: buf }, { quoted: msg });
    } catch (e) { return reply(sock, msg, ctx, '❌ ' + e.message); }
  },

  async ttp({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '✍️ Use: !ttp <texto>');
    try {
      const buf = await mediaHandler.fetchBuffer(`https://api.popcat.xyz/texttoimage?text=${encodeURIComponent(args.join(' '))}`);
      await sock.sendMessage(ctx.remoteJid, { sticker: buf }, { quoted: msg });
    } catch (e) { return reply(sock, msg, ctx, '❌ ' + e.message); }
  },

  // ============ GRUPOS ============
  async ban({ sock, msg, ctx }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos');
    if (!(await isAdmin(sock, ctx))) return reply(sock, msg, ctx, '🚫 Só admins');
    if (!(await botIsAdmin(sock, ctx))) return reply(sock, msg, ctx, '⚠️ Preciso ser admin');
    const t = getMentions(msg);
    if (!t.length) return reply(sock, msg, ctx, '🎯 Marque alguém');
    try {
      await sock.groupParticipantsUpdate(ctx.remoteJid, t, 'remove');
      await reply(sock, msg, ctx, `✅ Banido(s): ${t.length}`);
    } catch (e) { return reply(sock, msg, ctx, '❌ ' + e.message); }
  },
  async kick(a) { return module.exports.ban(a); },

  async promote({ sock, msg, ctx }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos');
    if (!(await isAdmin(sock, ctx))) return reply(sock, msg, ctx, '🚫 Só admins');
    if (!(await botIsAdmin(sock, ctx))) return reply(sock, msg, ctx, '⚠️ Preciso ser admin');
    const t = getMentions(msg);
    if (!t.length) return reply(sock, msg, ctx, '🎯 Marque alguém');
    try { await sock.groupParticipantsUpdate(ctx.remoteJid, t, 'promote'); return reply(sock, msg, ctx, '👑 Promovido!'); }
    catch (e) { return reply(sock, msg, ctx, '❌ ' + e.message); }
  },

  async demote({ sock, msg, ctx }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos');
    if (!(await isAdmin(sock, ctx))) return reply(sock, msg, ctx, '🚫 Só admins');
    if (!(await botIsAdmin(sock, ctx))) return reply(sock, msg, ctx, '⚠️ Preciso ser admin');
    const t = getMentions(msg);
    if (!t.length) return reply(sock, msg, ctx, '🎯 Marque alguém');
    try { await sock.groupParticipantsUpdate(ctx.remoteJid, t, 'demote'); return reply(sock, msg, ctx, '⬇️ Rebaixado'); }
    catch (e) { return reply(sock, msg, ctx, '❌ ' + e.message); }
  },

  async grupo({ sock, msg, ctx }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos');
    const meta = ctx.groupMeta || (await sock.groupMetadata(ctx.remoteJid));
    return reply(sock, msg, ctx, `╭━〔 *INFO GRUPO* 〕━╮
│ 📛 ${meta.subject}
│ 🆔 ${meta.id}
│ 👥 ${meta.participants.length} membros
│ 👑 ${meta.participants.filter(p=>p.admin).length} admins
│ 📅 ${meta.creation ? new Date(meta.creation*1000).toLocaleDateString('pt-BR') : '?'}
│ 📝 ${meta.desc || 'sem desc'}
╰━━━━━━━━━━━━━━━━━╯`);
  },

  async link({ sock, msg, ctx }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos');
    if (!(await botIsAdmin(sock, ctx))) return reply(sock, msg, ctx, '⚠️ Preciso ser admin');
    try { const c = await sock.groupInviteCode(ctx.remoteJid); return reply(sock, msg, ctx, `🔗 https://chat.whatsapp.com/${c}`); }
    catch (e) { return reply(sock, msg, ctx, '❌ ' + e.message); }
  },

  async revoke({ sock, msg, ctx }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos');
    if (!(await isAdmin(sock, ctx))) return reply(sock, msg, ctx, '🚫 Só admins');
    if (!(await botIsAdmin(sock, ctx))) return reply(sock, msg, ctx, '⚠️ Preciso ser admin');
    try { await sock.groupRevokeInvite(ctx.remoteJid); return reply(sock, msg, ctx, '🔄 Link resetado'); }
    catch (e) { return reply(sock, msg, ctx, '❌ ' + e.message); }
  },

  async open({ sock, msg, ctx }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos');
    if (!(await isAdmin(sock, ctx))) return reply(sock, msg, ctx, '🚫 Só admins');
    try { await sock.groupSettingUpdate(ctx.remoteJid, 'not_announcement'); return reply(sock, msg, ctx, '🔓 Aberto'); }
    catch (e) { return reply(sock, msg, ctx, '❌ ' + e.message); }
  },

  async close({ sock, msg, ctx }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos');
    if (!(await isAdmin(sock, ctx))) return reply(sock, msg, ctx, '🚫 Só admins');
    try { await sock.groupSettingUpdate(ctx.remoteJid, 'announcement'); return reply(sock, msg, ctx, '🔒 Fechado'); }
    catch (e) { return reply(sock, msg, ctx, '❌ ' + e.message); }
  },

  async todos({ sock, msg, ctx, args }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos');
    if (!(await isAdmin(sock, ctx))) return reply(sock, msg, ctx, '🚫 Só admins');
    const meta = ctx.groupMeta || (await sock.groupMetadata(ctx.remoteJid));
    const mentions = meta.participants.map(p => p.id);
    let text = `📢 *${args.join(' ') || 'Atenção!'}*\n\n`;
    meta.participants.forEach((p,i) => { text += `${i+1}. @${p.id.split('@')[0]}\n`; });
    await sock.sendMessage(ctx.remoteJid, { text, mentions });
  },

  async hidetag({ sock, msg, ctx, args }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos');
    if (!(await isAdmin(sock, ctx))) return reply(sock, msg, ctx, '🚫 Só admins');
    const meta = ctx.groupMeta || (await sock.groupMetadata(ctx.remoteJid));
    await sock.sendMessage(ctx.remoteJid, {
      text: args.join(' ') || '📢 Atenção!',
      mentions: meta.participants.map(p => p.id),
    });
  },

  async antilink({ sock, msg, ctx, args }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos');
    if (!(await isAdmin(sock, ctx))) return reply(sock, msg, ctx, '🚫 Só admins');

    const GroupSettings = require('../database/models/GroupSettings');
    const action = args[0]?.toLowerCase();

    // Mostra status atual
    if (!action || action === 'status') {
      const gs = await GroupSettings.findOne({ groupJid: ctx.remoteJid });
      const enabled = gs?.antilink || false;
      const mode = gs?.antilinkMode || 'smart';
      const wl = (gs?.antilinkWhitelist || []).join(', ') || 'nenhum';
      return reply(sock, msg, ctx,
        `╔═══════════════════════════════╗\n` +
        `║  🛡️ *ANTI-LINK STATUS*  ║\n` +
        `╚═══════════════════════════════╝\n\n` +
        `▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱\n` +
        `Status: ${enabled ? '🟢 ATIVO' : '🔴 OFF'}\n` +
        `Modo:   ${mode}\n` +
        `Ação:   ${gs?.antilinkAction || 'warn'}\n` +
        `Avisos: ${gs?.maxWarns || 3} → ban\n` +
        `Whitelist: ${wl}\n` +
        `▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱\n\n` +
        `*Comandos:*\n` +
        `◈ ${config.bot.prefix}antilink on/off\n` +
        `◈ ${config.bot.prefix}antilink modo smart|whatsapp_only|all_links\n` +
        `◈ ${config.bot.prefix}antilink acao warn|kick\n` +
        `◈ ${config.bot.prefix}antilink permitir <dominio>\n` +
        `◈ ${config.bot.prefix}antilink remover <dominio>\n` +
        `◈ ${config.bot.prefix}antilink avisos <n>`
      );
    }

    let gs = await GroupSettings.findOne({ groupJid: ctx.remoteJid });
    if (!gs) gs = await GroupSettings.create({ groupJid: ctx.remoteJid, groupName: ctx.groupName || '' });

    if (action === 'on') {
      gs.antilink = true; await gs.save();
      return reply(sock, msg, ctx, '✅ Anti-link *ATIVADO* neste grupo\n_Modo:_ ' + (gs.antilinkMode || 'smart'));
    }
    if (action === 'off') {
      gs.antilink = false; await gs.save();
      return reply(sock, msg, ctx, '❌ Anti-link *DESATIVADO* neste grupo');
    }
    if (action === 'modo' && args[1]) {
      const m = args[1].toLowerCase();
      if (!['smart', 'whatsapp_only', 'all_links'].includes(m)) {
        return reply(sock, msg, ctx, '❌ Modo inválido. Use: smart, whatsapp_only, all_links');
      }
      gs.antilinkMode = m; await gs.save();
      return reply(sock, msg, ctx, `✅ Modo: *${m}*`);
    }
    if (action === 'acao' && args[1]) {
      const a = args[1].toLowerCase();
      if (!['warn', 'kick'].includes(a)) return reply(sock, msg, ctx, '❌ Use: warn ou kick');
      gs.antilinkAction = a; await gs.save();
      return reply(sock, msg, ctx, `✅ Ação: *${a}*`);
    }
    if (action === 'permitir' && args[1]) {
      const dom = args[1].toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*/, '');
      gs.antilinkWhitelist = [...new Set([...(gs.antilinkWhitelist || []), dom])];
      await gs.save();
      return reply(sock, msg, ctx, `✅ Adicionado à whitelist: *${dom}*`);
    }
    if (action === 'remover' && args[1]) {
      const dom = args[1].toLowerCase();
      gs.antilinkWhitelist = (gs.antilinkWhitelist || []).filter(d => d !== dom);
      await gs.save();
      return reply(sock, msg, ctx, `✅ Removido da whitelist: *${dom}*`);
    }
    if (action === 'avisos' && args[1]) {
      const n = parseInt(args[1]);
      if (!n || n < 1 || n > 10) return reply(sock, msg, ctx, '❌ Use número 1-10');
      gs.maxWarns = n; await gs.save();
      return reply(sock, msg, ctx, `✅ Max avisos: *${n}* (depois ban)`);
    }

    return reply(sock, msg, ctx, `Use: ${config.bot.prefix}antilink status`);
  },

  async antispam({ sock, msg, ctx, args }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos');
    if (!(await isAdmin(sock, ctx))) return reply(sock, msg, ctx, '🚫 Só admins');
    const on = args[0]?.toLowerCase() === 'on';
    await BotConfig.set('antispam_enabled', on);
    return reply(sock, msg, ctx, on ? '✅ Anti-spam ATIVADO' : '❌ Anti-spam DESATIVADO');
  },

  async welcome({ sock, msg, ctx, args }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos');
    if (!(await isAdmin(sock, ctx))) return reply(sock, msg, ctx, '🚫 Só admins');
    const on = args[0]?.toLowerCase() === 'on';
    await BotConfig.set('welcome_enabled', on);
    return reply(sock, msg, ctx, on ? '✅ Boas-vindas ATIVADAS' : '❌ Boas-vindas DESATIVADAS');
  },

  // ============ DIVERSÃO ============
  async dado({ sock, msg, ctx }) { return reply(sock, msg, ctx, `🎲 ${Math.floor(Math.random()*6)+1}`); },
  async moeda({ sock, msg, ctx }) { return reply(sock, msg, ctx, Math.random()>0.5 ? '🪙 *Cara*' : '🪙 *Coroa*'); },

  async piada({ sock, msg, ctx }) {
    const p = [
      'Por que o livro de mat estava triste?\n— Muitos problemas.',
      'O que o pato disse à pata?\n— Vem quá!',
      'O que a impressora disse à outra?\n— Essa folha é sua ou é impressão minha?',
      'Qual o doce preferido do físico?\n— Pi.',
      'O tomate foi ao banco fazer o quê?\n— Tirar extrato.',
    ];
    return reply(sock, msg, ctx, `😂 ${p[Math.floor(Math.random()*p.length)]}`);
  },

  async frase({ sock, msg, ctx }) {
    const f = [
      '💡 "O sucesso é a soma de pequenos esforços." — R. Collier',
      '🌙 "Nas sombras encontramos a verdadeira luz." — Dark Net',
      '⚡ "Aja como se fosse impossível falhar." — Churchill',
      '🚀 "Comece onde está. Use o que tem. Faça o que pode." — A. Ashe',
    ];
    return reply(sock, msg, ctx, f[Math.floor(Math.random()*f.length)]);
  },

  async ppt({ sock, msg, ctx, args }) {
    const opts = ['pedra','papel','tesoura'];
    const c = args[0]?.toLowerCase();
    if (!opts.includes(c)) return reply(sock, msg, ctx, '🎮 Use: !ppt pedra/papel/tesoura');
    const b = opts[Math.floor(Math.random()*3)];
    let r = '🤝 Empate';
    if ((c==='pedra'&&b==='tesoura')||(c==='papel'&&b==='pedra')||(c==='tesoura'&&b==='papel')) r = '🏆 Venceu!';
    else if (c !== b) r = '💀 Perdeu';
    return reply(sock, msg, ctx, `Você: *${c}*\nBot: *${b}*\n\n${r}`);
  },

  async gay({ sock, msg, ctx }) {
    const t = getMentions(msg)[0] || ctx.senderJid;
    await sock.sendMessage(ctx.remoteJid, { text: `🏳️‍🌈 @${t.split('@')[0]} é *${Math.floor(Math.random()*101)}%* gay!`, mentions: [t] }, { quoted: msg });
  },

  async casal({ sock, msg, ctx }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos');
    const meta = ctx.groupMeta || (await sock.groupMetadata(ctx.remoteJid));
    const p = meta.participants;
    const a = p[Math.floor(Math.random()*p.length)].id;
    let b = p[Math.floor(Math.random()*p.length)].id;
    while (b===a && p.length>1) b = p[Math.floor(Math.random()*p.length)].id;
    await sock.sendMessage(ctx.remoteJid, {
      text: `💕 *Casal do dia*\n\n@${a.split('@')[0]} 💖 @${b.split('@')[0]}\nCompatibilidade: *${Math.floor(Math.random()*101)}%*`,
      mentions: [a,b],
    }, { quoted: msg });
  },

  async ship({ sock, msg, ctx }) {
    const t = getMentions(msg);
    if (t.length < 2) return reply(sock, msg, ctx, '💕 Marque 2: !ship @a @b');
    await sock.sendMessage(ctx.remoteJid, {
      text: `💕 @${t[0].split('@')[0]} + @${t[1].split('@')[0]}\n❤️ ${Math.floor(Math.random()*101)}%`,
      mentions: t,
    }, { quoted: msg });
  },

  async roleta({ sock, msg, ctx }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos');
    const meta = ctx.groupMeta || (await sock.groupMetadata(ctx.remoteJid));
    const p = meta.participants;
    const chosen = p[Math.floor(Math.random()*p.length)].id;
    await sock.sendMessage(ctx.remoteJid, { text: `🎰 *ROLETA*\n\nO escolhido foi: @${chosen.split('@')[0]} 🎉`, mentions: [chosen] }, { quoted: msg });
  },

  async fofoca({ sock, msg, ctx }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos');
    const meta = ctx.groupMeta || (await sock.groupMetadata(ctx.remoteJid));
    const p = meta.participants;
    const a = p[Math.floor(Math.random()*p.length)].id;
    let b = p[Math.floor(Math.random()*p.length)].id;
    while (b===a && p.length>1) b = p[Math.floor(Math.random()*p.length)].id;
    const fofs = [
      'está apaixonado(a) por', 'foi visto(a) com', 'mandou indireta para',
      'está stalkeando', 'ficou de vez com', 'tem um caso secreto com',
    ];
    await sock.sendMessage(ctx.remoteJid, {
      text: `🤫 *FOFOCA*\n\nDizem que @${a.split('@')[0]} ${fofs[Math.floor(Math.random()*fofs.length)]} @${b.split('@')[0]}!`,
      mentions: [a,b],
    }, { quoted: msg });
  },

  // ============ UTILS ============
  async qrcode({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '📱 Use: !qrcode <texto>');
    const QR = require('qrcode');
    const buf = await QR.toBuffer(args.join(' '), { width: 400 });
    await sock.sendMessage(ctx.remoteJid, { image: buf, caption: '📱 QR Code' }, { quoted: msg });
  },

  async calc({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '🧮 Use: !calc 2+2');
    try {
      const e = args.join('').replace(/[^0-9+\-*/().]/g,'');
      const r = Function('"use strict";return ('+e+')')();
      return reply(sock, msg, ctx, `🧮 ${e} = *${r}*`);
    } catch { return reply(sock, msg, ctx, '❌ Expr inválida'); }
  },

  async translate({ sock, msg, ctx, args }) {
    if (args.length < 2) return reply(sock, msg, ctx, '🌐 !translate <lang> <texto>');
    try {
      const lang = args.shift();
      const r = await mediaHandler.fetchJson(`https://api.popcat.xyz/translate?to=${lang}&text=${encodeURIComponent(args.join(' '))}`);
      return reply(sock, msg, ctx, `🌐 *${lang}*\n\n${r.translated || r.text || 'erro'}`);
    } catch (e) { return reply(sock, msg, ctx, '❌ ' + e.message); }
  },

  async clima({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '☀️ Use: !clima <cidade>');
    try {
      const r = await mediaHandler.fetchJson(`https://wttr.in/${encodeURIComponent(args.join(' '))}?format=j1&lang=pt`);
      const c = r.current_condition[0];
      return reply(sock, msg, ctx, `☀️ *Clima em ${args.join(' ')}*\n\n🌡️ Temp: ${c.temp_C}°C (sente ${c.FeelsLikeC}°C)\n💧 Umidade: ${c.humidity}%\n💨 Vento: ${c.windspeedKmph} km/h\n☁️ ${c.lang_pt?.[0]?.value || c.weatherDesc[0].value}`);
    } catch (e) { return reply(sock, msg, ctx, '❌ ' + e.message); }
  },

  async encurtar({ sock, msg, ctx, args }) {
    if (!args.length) return reply(sock, msg, ctx, '🔗 Use: !encurtar <url>');
    try {
      const r = await mediaHandler.fetchBuffer(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(args[0])}`);
      return reply(sock, msg, ctx, `🔗 Encurtado:\n${r.toString('utf-8')}`);
    } catch (e) { return reply(sock, msg, ctx, '❌ ' + e.message); }
  },

  // ============ VIP/PREMIUM ============
  async vip({ sock, msg, ctx, config }) {
    return reply(sock, msg, ctx, `╭━〔 ⭐ *VIP/PREMIUM* 〕━╮
│
│ 🎯 Vantagens:
│   ✅ Comandos exclusivos
│   ✅ Sem limite
│   ✅ Prioridade
│   ✅ Stickers ilimitados
│   ✅ Downloads HD
│   ✅ IA premium
│
│ 💎 Planos:
│   • 1 mês — *1.500 Kz*
│   • 3 meses — *4.000 Kz*
│   • 6 meses — *7.500 Kz*
│   • 1 ano — *14.000 Kz*
│   • Vitalício — *30.000 Kz*
│
│ 💳 Para assinar:
│   ${config.bot.prefix}assinar
│
│ 📞 wa.me/${config.owner.number}
│
╰━━━━━━━━━━━━━━━━━━━╯`);
  },

  async assinar({ sock, msg, ctx, config }) {
    return reply(sock, msg, ctx, `💎 *COMO ASSINAR PREMIUM*

1️⃣ Escolha um plano em ${config.bot.prefix}vip
2️⃣ Faça pagamento (Multicaixa Express, Pix, Unitel Money):

📱 *Multicaixa Express:*
   Número: +${config.owner.number}
   Nome: ${config.owner.name}

3️⃣ Acesse o dashboard:
   ${process.env.APP_URL || 'https://dark-bot.onrender.com'}
   
4️⃣ Crie/faça login na sua conta
5️⃣ Vá em "Assinatura Premium" e envie o comprovante

⏱️ Aprovação em até 24h
📞 wa.me/${config.owner.number}`);
  },

  async meuplano({ sock, msg, ctx }) {
    const u = await User.findOne({ whatsappNumber: ctx.senderNumber });
    if (!u) return reply(sock, msg, ctx, '🆓 Você ainda não tem conta. Acesse o dashboard!');
    if (u.role === 'owner') return reply(sock, msg, ctx, '👑 Você é o DONO!');
    if (u.role === 'premium' && u.isPremium()) {
      return reply(sock, msg, ctx, `⭐ *PREMIUM ATIVO*\n\n⏳ Válido até: ${new Date(u.premiumUntil).toLocaleDateString('pt-BR')}\n📊 Comandos: ${u.commandsUsed}`);
    }
    return reply(sock, msg, ctx, '🆓 Você é Free. Use !vip para conhecer os planos.');
  },

  // ============ DONO ============
  async broadcast({ sock, msg, ctx, args, isOwner, config }) {
    if (!isOwner) return reply(sock, msg, ctx, '🚫 Só Dono');
    if (!args.length) return reply(sock, msg, ctx, '📢 Use: !broadcast <msg>');
    const message = args.join(' ');
    try {
      const chats = await sock.groupFetchAllParticipating();
      const ids = Object.keys(chats);
      let count = 0;
      for (const id of ids) {
        try {
          await sock.sendMessage(id, { text: `📢 *BROADCAST*\n\n${message}\n\n_— ${config.owner.name}_` });
          count++;
          await new Promise(r => setTimeout(r, 1500));
        } catch (e) {}
      }
      return reply(sock, msg, ctx, `✅ Enviado para *${count}* grupos`);
    } catch (e) { return reply(sock, msg, ctx, '❌ ' + e.message); }
  },

  async setpremium({ sock, msg, ctx, args, isOwner }) {
    if (!isOwner) return reply(sock, msg, ctx, '🚫 Só Dono');
    const num = args[0]?.replace(/\D/g,'');
    const days = parseInt(args[1]) || 30;
    if (!num) return reply(sock, msg, ctx, '⭐ Use: !setpremium <num> [dias]');
    const until = new Date(Date.now() + days*86400000);
    let u = await User.findOne({ whatsappNumber: num });
    if (!u) {
      u = await User.create({
        username: 'wa_'+num, password: Math.random().toString(36),
        name: 'WhatsApp '+num, whatsappNumber: num,
        role: 'premium', premiumUntil: until,
      });
    } else { u.role='premium'; u.premiumUntil=until; await u.save(); }
    return reply(sock, msg, ctx, `⭐ ${num} é Premium até ${until.toLocaleDateString('pt-BR')}`);
  },

  async blacklist({ sock, msg, ctx, args, isOwner }) {
    if (!isOwner) return reply(sock, msg, ctx, '🚫 Só Dono');
    const num = args[0]?.replace(/\D/g,'');
    if (!num) return reply(sock, msg, ctx, '🚫 Use: !blacklist <num>');
    const bl = await BotConfig.get('blacklist', []);
    if (!bl.includes(num)) bl.push(num);
    await BotConfig.set('blacklist', bl);
    return reply(sock, msg, ctx, `🚫 ${num} bloqueado`);
  },

  async unblacklist({ sock, msg, ctx, args, isOwner }) {
    if (!isOwner) return reply(sock, msg, ctx, '🚫 Só Dono');
    const num = args[0]?.replace(/\D/g,'');
    let bl = await BotConfig.get('blacklist', []);
    bl = bl.filter(x => x !== num);
    await BotConfig.set('blacklist', bl);
    return reply(sock, msg, ctx, `✅ ${num} desbloqueado`);
  },

  async stats({ sock, msg, ctx, isOwner }) {
    if (!isOwner) return reply(sock, msg, ctx, '🚫 Só Dono');
    const users = await User.countDocuments();
    const premium = await User.countDocuments({ role: 'premium' });
    const cmds = await Command.countDocuments();
    const logs = await Log.countDocuments({ createdAt: { $gte: new Date(Date.now()-86400000) } });
    return reply(sock, msg, ctx, `╭━〔 📊 *STATS* 〕━╮
│ 👥 Usuários: ${users}
│ ⭐ Premium: ${premium}
│ ⚡ Comandos DB: ${cmds}
│ 📊 Cmds 24h: ${logs}
│ ⏱️ Up: ${formatUptime(Date.now()-startTime)}
│ 💾 RAM: ${Math.round(process.memoryUsage().heapUsed/1024/1024)}MB
╰━━━━━━━━━━━━━━━━╯`);
  },

  async agendar({ sock, msg, ctx, args, isOwner }) {
    if (!isOwner) return reply(sock, msg, ctx, '🚫 Só Dono');
    return reply(sock, msg, ctx, `📅 *Agendamento*\n\nUse o dashboard para agendar mensagens:\n${process.env.APP_URL || 'https://dark-bot.onrender.com'}/dashboard/schedule`);
  },

  async backup({ sock, msg, ctx, isOwner }) {
    if (!isOwner) return reply(sock, msg, ctx, '🚫 Só Dono');
    return reply(sock, msg, ctx, `💾 Use o dashboard para backup:\n${process.env.APP_URL || ''}/dashboard/backup`);
  },

  async restart({ sock, msg, ctx, isOwner }) {
    if (!isOwner) return reply(sock, msg, ctx, '🚫 Só Dono');
    await reply(sock, msg, ctx, '🔄 Reiniciando em 3s...');
    setTimeout(() => process.exit(0), 3000); // Render reinicia automaticamente
  },

  async decrypt({ sock, msg, ctx, config }) {
    return reply(sock, msg, ctx, `╭━━〔 🔓 *VPN DECRYPTER* 〕━━╮
│
│ 🎯 *Como usar:*
│ Envie o arquivo VPN como
│ documento (📎) com a legenda:
│
│ • ${config.bot.prefix}decrypt
│   ou ${config.bot.prefix}vpn
│
│ 📁 *Formatos suportados:*
│ • .ehi / .ehic (HTTP Injector)
│ • .hat (HA Tunnel Plus)
│ • .npv4/.npv7/.npv8 (NPV Tunnel)
│ • .dark / .darkt (DarkTunnel)
│ • .any (AnyTunnel Lite)
│ • .tls (TLS Tunnel)
│ • .nm / .nmess (NetMod)
│ • .conf (WireGuard)
│ • .ovpn (OpenVPN)
│ • .ssh / .ssl
│ • .json (V2Ray/VMess)
│ • .txt (vmess/vless/trojan/ss/ssh URI)
│
│ 🔓 *Extrai automaticamente:*
│ • SNI, Proxy Host, Porta
│ • SSH User & Pass
│ • Payload, Method
│ • UUID, PSK, DNS
│ • Tudo o que estiver no arquivo!
│
│ ⭐ Recurso *Premium*
│ 📞 wa.me/${config.owner.number}
│
╰━━━━━━━━━━━━━━━━━━━━━━╯`);
  },

  async vpn(a) { return module.exports.decrypt(a); },
  async vpndec(a) { return module.exports.decrypt(a); },

};
