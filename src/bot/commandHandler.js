const config = require('../config');
const Command = require('../database/models/Command');
const User = require('../database/models/User');
const mediaHandler = require('./mediaHandler');
const stickerMaker = require('./stickerMaker');
const nativeCommands = require('./nativeCommands');

function extractText(msg) {
  const m = msg.message;
  return (
    m?.conversation ||
    m?.extendedTextMessage?.text ||
    m?.imageMessage?.caption ||
    m?.videoMessage?.caption ||
    m?.documentMessage?.caption ||
    ''
  );
}

function getSenderInfo(msg) {
  const remoteJid = msg.key.remoteJid;
  const isGroup = remoteJid?.endsWith('@g.us');
  const senderJid = isGroup ? msg.key.participant : remoteJid;
  const senderNumber = senderJid?.split('@')[0] || '';
  const pushName = msg.pushName || 'Usuário';
  return { remoteJid, isGroup, senderJid, senderNumber, pushName };
}

function fillVars(text, ctx) {
  return text
    .replace(/{user}/gi, ctx.pushName)
    .replace(/{number}/gi, ctx.senderNumber)
    .replace(/{bot}/gi, config.bot.name)
    .replace(/{owner}/gi, config.owner.name)
    .replace(/{group}/gi, ctx.groupName || 'privado')
    .replace(/{prefix}/gi, config.bot.prefix)
    .replace(/{date}/gi, new Date().toLocaleDateString('pt-BR'))
    .replace(/{time}/gi, new Date().toLocaleTimeString('pt-BR'));
}

async function handle(sock, msg) {
  const text = extractText(msg).trim();
  const ctx = getSenderInfo(msg);
  const prefix = config.bot.prefix;

  // Group name
  if (ctx.isGroup) {
    try {
      const meta = await sock.groupMetadata(ctx.remoteJid);
      ctx.groupName = meta.subject;
      ctx.groupMeta = meta;
    } catch (e) {}
  }

  const isMedia = msg.message?.imageMessage || msg.message?.videoMessage;

  // Sticker via media+caption
  if (isMedia && (text === `${prefix}sticker` || text === `${prefix}s` || text === `${prefix}fig`)) {
    return handleStickerRequest(sock, msg, ctx);
  }

  if (!text.startsWith(prefix)) return false;

  const args = text.slice(prefix.length).trim().split(/\s+/);
  const commandName = args.shift().toLowerCase();
  if (!commandName) return false;

  const isOwner = ctx.senderNumber === config.owner.number;

  // Native commands
  if (nativeCommands[commandName]) {
    try {
      await nativeCommands[commandName]({ sock, msg, ctx, args, isOwner, fillVars, config });
      return true;
    } catch (err) {
      console.error(`Erro comando ${commandName}:`, err);
      await sock.sendMessage(ctx.remoteJid, { text: `❌ Erro: ${err.message}` }, { quoted: msg });
      return true;
    }
  }

  // Aliases nativos
  const aliasMap = {
    help: 'menu', cmds: 'menu', comandos: 'menu',
    s: 'sticker', fig: 'sticker',
    owner: 'dono',
    yt: 'play', musica: 'play',
    tt: 'tiktok', ig: 'instagram',
  };
  if (aliasMap[commandName] && nativeCommands[aliasMap[commandName]]) {
    try {
      await nativeCommands[aliasMap[commandName]]({ sock, msg, ctx, args, isOwner, fillVars, config });
      return true;
    } catch (err) {
      await sock.sendMessage(ctx.remoteJid, { text: `❌ Erro: ${err.message}` }, { quoted: msg });
      return true;
    }
  }

  // DB commands
  try {
    const cmd = await Command.findOne({
      $or: [{ name: commandName }, { aliases: commandName }],
      enabled: true,
    });
    if (!cmd) return false;

    if (cmd.accessLevel === 'owner' && !isOwner) {
      await sock.sendMessage(ctx.remoteJid, { text: '🚫 Comando exclusivo do Dono.' }, { quoted: msg });
      return true;
    }
    if (cmd.accessLevel === 'premium') {
      const user = await User.findOne({ whatsappNumber: ctx.senderNumber });
      const isPrem = isOwner || (user && user.isPremium());
      if (!isPrem) {
        await sock.sendMessage(
          ctx.remoteJid,
          { text: `⭐ *Comando Premium*\n\nFale com o dono: wa.me/${config.owner.number}` },
          { quoted: msg }
        );
        return true;
      }
    }

    cmd.usageCount = (cmd.usageCount || 0) + 1;
    await cmd.save();

    const responseText = fillVars(cmd.response || '', ctx);

    if (cmd.mediaUrl && cmd.mediaType) {
      const buffer = await mediaHandler.fetchBuffer(cmd.mediaUrl);
      if (cmd.mediaType === 'image' || cmd.mediaType === 'gif') {
        await sock.sendMessage(ctx.remoteJid, { image: buffer, caption: responseText }, { quoted: msg });
      } else if (cmd.mediaType === 'video') {
        await sock.sendMessage(ctx.remoteJid, { video: buffer, caption: responseText }, { quoted: msg });
      } else if (cmd.mediaType === 'audio') {
        await sock.sendMessage(ctx.remoteJid, { audio: buffer, mimetype: 'audio/mp4' }, { quoted: msg });
      } else {
        await sock.sendMessage(ctx.remoteJid, { text: responseText }, { quoted: msg });
      }
    } else if (responseText) {
      await sock.sendMessage(ctx.remoteJid, { text: responseText }, { quoted: msg });
    }
    return true;
  } catch (err) {
    console.error('Erro DB cmd:', err);
    return false;
  }
}

async function handleStickerRequest(sock, msg, ctx) {
  try {
    await sock.sendMessage(ctx.remoteJid, { react: { text: '⏳', key: msg.key } });

    const groupName = ctx.groupName || 'Privado';
    const buffer = await mediaHandler.downloadFromMessage(msg);
    const stickerBuffer = await stickerMaker.create(buffer, {
      botName: config.bot.name,
      ownerName: config.owner.name,
      userName: ctx.pushName,
      groupName,
      isVideo: !!msg.message?.videoMessage,
    });

    await sock.sendMessage(ctx.remoteJid, { sticker: stickerBuffer }, { quoted: msg });
    await sock.sendMessage(ctx.remoteJid, { react: { text: '✅', key: msg.key } });
  } catch (err) {
    console.error('Erro sticker:', err);
    await sock.sendMessage(ctx.remoteJid, { text: '❌ Falha ao criar sticker: ' + err.message }, { quoted: msg });
  }
}

module.exports = { handle, extractText, getSenderInfo, fillVars };
