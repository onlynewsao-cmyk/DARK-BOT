const config = require('../config');
const Command = require('../database/models/Command');
const User = require('../database/models/User');
const BotConfig = require('../database/models/BotConfig');
const Log = require('../database/models/Log');
const DecryptLog = require('../database/models/DecryptLog');
const CommandOverride = require('../database/models/CommandOverride');
const GroupSettings = require('../database/models/GroupSettings');
const mediaHandler = require('./mediaHandler');
const stickerMaker = require('./stickerMaker');
const nativeCommands = require('./nativeCommands');
const interactions = require('./packages/interactions');
const family = require('./packages/family');
const economy = require('./packages/economy');
const games = require('./packages/games');
const cheats = require('./packages/cheats');
const prefixManager = require('./prefixManager');
const reactions = require('./reactions');

const packageCommands = { ...interactions, ...family, ...economy, ...games, ...cheats };
const ai = require('./ai');
const decrypter = require('../decrypter');
const { formatForWhatsApp } = require('../decrypter/formatter');

function extractText(msg) {
  const m = msg.message;
  return m?.conversation || m?.extendedTextMessage?.text ||
    m?.imageMessage?.caption || m?.videoMessage?.caption ||
    m?.documentMessage?.caption || m?.documentWithCaptionMessage?.message?.documentMessage?.caption || '';
}

function getSenderInfo(msg) {
  const remoteJid = msg.key.remoteJid;
  const isGroup = remoteJid?.endsWith('@g.us');
  const senderJid = isGroup ? msg.key.participant : remoteJid;
  const senderNumber = senderJid?.split('@')[0]?.split(':')[0] || '';
  const pushName = msg.pushName || 'Usuário';
  return { remoteJid, isGroup, senderJid, senderNumber, pushName };
}

function fillVars(text, ctx, prefix) {
  return text
    .replace(/{user}/gi, ctx.pushName).replace(/{number}/gi, ctx.senderNumber)
    .replace(/{bot}/gi, config.bot.name).replace(/{owner}/gi, config.owner.name)
    .replace(/{group}/gi, ctx.groupName || 'privado').replace(/{prefix}/gi, prefix || config.bot.prefix)
    .replace(/{date}/gi, new Date().toLocaleDateString('pt-BR'))
    .replace(/{time}/gi, new Date().toLocaleTimeString('pt-BR'));
}

async function handle(sock, msg) {
  const text = extractText(msg).trim();
  const ctx = getSenderInfo(msg);
  // Detecção robusta do dono — compara apenas o número, ignora :XX e @lid
  const cleanSenderNum = (ctx.senderNumber || '').replace(/\D/g, '');
  const cleanOwnerNum = (config.owner.number || '').replace(/\D/g, '');
  const isOwner = cleanSenderNum === cleanOwnerNum;

  // Detecta prefixo (multi-prefixo)
  const prefixDetection = await prefixManager.detectPrefix(text);
  const prefixes = await prefixManager.getPrefixes();
  const primaryPrefix = prefixes[0] || '!';

  // Disponibiliza no config para os comandos
  config.bot.prefix = primaryPrefix;
  config.bot.prefixes = prefixes;

  // Blacklist
  const blacklist = await BotConfig.get('blacklist', []).catch(() => []);
  if (blacklist.includes(ctx.senderNumber) && !isOwner) return false;

  // Group settings (bot pode estar desativado neste grupo)
  if (ctx.isGroup) {
    try {
      const gs = await GroupSettings.findOne({ groupJid: ctx.remoteJid });
      if (gs && gs.botEnabled === false && !isOwner) return false;
      ctx.groupSettings = gs;
    } catch (e) {}
  }

  // Group info
  if (ctx.isGroup) {
    try {
      const meta = await sock.groupMetadata(ctx.remoteJid);
      ctx.groupName = meta.subject;
      ctx.groupMeta = meta;
    } catch (e) {}
  }

  // ===== DECRYPT VPN =====
  const docMsg = msg.message?.documentMessage || msg.message?.documentWithCaptionMessage?.message?.documentMessage;
  if (docMsg) {
    const caption = (text || '').toLowerCase();
    const isDecryptRequest = prefixes.some(p =>
      caption.includes(`${p}decrypt`) || caption.includes(`${p}vpn`) ||
      caption.includes(`${p}dec`) || caption.includes(`${p}vpndec`)
    );
    const fileName = docMsg.fileName || 'unknown';
    const ext = fileName.split('.').pop()?.toLowerCase();
    const supportedExts = ['ehi','ehic','hat','npv','npv4','npv7','npv8','dark','darkt','any','tls','conf','nm','nmess','ovpn','ssh','ssl','json','txt'];

    if (isDecryptRequest || (supportedExts.includes(ext) && !prefixDetection)) {
      return handleDecryptRequest(sock, msg, ctx, docMsg, isOwner);
    }
  }

  // ===== Auto-IA quando mencionado =====
  const botNum = (sock.user?.id || '').split(':')[0].split('@')[0];
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const isMentioned = mentioned.some(j => (j || '').split('@')[0] === botNum);
  const isReplyToBot = (msg.message?.extendedTextMessage?.contextInfo?.participant || '').split('@')[0] === botNum;
  const aiAutoEnabled = await BotConfig.get('ai_auto_enabled', false).catch(() => false);
  if (aiAutoEnabled && !prefixDetection && (isMentioned || isReplyToBot || !ctx.isGroup)) {
    try {
      const cleanText = text.replace(/@\d+/g, '').trim();
      if (cleanText.length > 2) {
        await sock.sendMessage(ctx.remoteJid, { react: { text: '🤔', key: msg.key } });
        const answer = await ai.chat(cleanText);
        await sock.sendMessage(ctx.remoteJid, { text: `🧠 ${answer}` }, { quoted: msg });
        await sock.sendMessage(ctx.remoteJid, { react: { text: '✅', key: msg.key } });
        return true;
      }
    } catch (e) {}
  }

  // Sticker em mídia
  const isMedia = msg.message?.imageMessage || msg.message?.videoMessage;
  if (isMedia && prefixDetection) {
    const cmd = prefixDetection.rest.toLowerCase().split(/\s+/)[0];
    if (['sticker', 's', 'fig'].includes(cmd)) {
      return handleStickerRequest(sock, msg, ctx);
    }
  }

  if (!prefixDetection) return false;

  const args = prefixDetection.rest.split(/\s+/);
  const commandName = args.shift().toLowerCase();
  if (!commandName) return false;

  const currentPrefix = prefixDetection.prefix;

  // Comandos dos pacotes
  if (packageCommands[commandName]) {
    try {
      await reactions.reactStart(sock, msg, commandName);
      await packageCommands[commandName]({ sock, msg, ctx, args, isOwner, fillVars: (t) => fillVars(t, ctx, currentPrefix), config });
      await reactions.reactSuccess(sock, msg, commandName);
      await incrementUserCommand(ctx.senderNumber);
      return true;
    } catch (err) {
      console.error('pkg err:', commandName, err);
      await reactions.reactError(sock, msg, commandName);
      await sock.sendMessage(ctx.remoteJid, { text: '❌ ' + err.message }, { quoted: msg });
      return true;
    }
  }

  if (nativeCommands[commandName]) {
    try {
      // Aplicar override (dashboard pode ter mudado o comportamento)
      const override = await CommandOverride.findOne({ commandName }).catch(()=>null);
      if (override) {
        if (override.enabled === false) {
          await sock.sendMessage(ctx.remoteJid, { text: `🚫 Comando *${commandName}* está desativado pelo Dono.` }, { quoted: msg });
          return true;
        }
        if (override.accessLevel === 'owner' && !isOwner) {
          await sock.sendMessage(ctx.remoteJid, { text: '🚫 Só Dono.' }, { quoted: msg });
          return true;
        }
        if (override.accessLevel === 'premium') {
          const user = await User.findOne({ whatsappNumber: ctx.senderNumber });
          const isPrem = isOwner || (user && user.isPremium());
          if (!isPrem) {
            await sock.sendMessage(ctx.remoteJid, { text: `⭐ Comando *Premium*. Use ${currentPrefix}vip` }, { quoted: msg });
            return true;
          }
        }
        override.usageCount = (override.usageCount || 0) + 1;
        await override.save();

        // Se tem resposta customizada, manda ela em vez de rodar o comando nativo
        if (override.useCustomResponse && override.customResponse) {
          await reactions.reactStart(sock, msg, commandName);
          const responseText = fillVars(override.customResponse, ctx, currentPrefix);
          if (override.mediaUrl && override.mediaType) {
            const buffer = await mediaHandler.fetchBuffer(override.mediaUrl);
            const payload = override.mediaType === 'image' || override.mediaType === 'gif'
              ? { image: buffer, caption: responseText }
              : override.mediaType === 'video' ? { video: buffer, caption: responseText }
              : override.mediaType === 'audio' ? { audio: buffer, mimetype: 'audio/mp4' }
              : { text: responseText };
            await sock.sendMessage(ctx.remoteJid, payload, { quoted: msg });
          } else {
            await sock.sendMessage(ctx.remoteJid, { text: responseText }, { quoted: msg });
          }
          await reactions.reactSuccess(sock, msg, commandName);
          await incrementUserCommand(ctx.senderNumber);
          return true;
        }
      }

      await reactions.reactStart(sock, msg, commandName);
      await nativeCommands[commandName]({ sock, msg, ctx, args, isOwner, fillVars: (t) => fillVars(t, ctx, currentPrefix), config });

      // Se override tem mídia anexa (sem resposta custom), envia depois
      if (override && override.mediaUrl && override.mediaType && !override.useCustomResponse) {
        try {
          const buffer = await mediaHandler.fetchBuffer(override.mediaUrl);
          const payload = override.mediaType === 'image' || override.mediaType === 'gif'
            ? { image: buffer } : override.mediaType === 'video' ? { video: buffer }
            : override.mediaType === 'audio' ? { audio: buffer, mimetype: 'audio/mp4' } : null;
          if (payload) await sock.sendMessage(ctx.remoteJid, payload);
        } catch (e) {}
      }

      await reactions.reactSuccess(sock, msg, commandName);
      await incrementUserCommand(ctx.senderNumber);
      return true;
    } catch (err) {
      console.error('cmd err:', commandName, err);
      await reactions.reactError(sock, msg, commandName);
      await sock.sendMessage(ctx.remoteJid, { text: '❌ ' + err.message }, { quoted: msg });
      return true;
    }
  }

  const aliasMap = {
    help: 'menu', cmds: 'menu', comandos: 'menu',
    s: 'sticker', fig: 'sticker', owner: 'dono', bot: 'info',
    yt: 'play', musica: 'play', music: 'play',
    tt: 'tiktok', ig: 'instagram', x: 'twitter',
    sp: 'spotify', sc: 'soundcloud', pin: 'pinterest',
    ai: 'ia', chatgpt: 'ia', llm: 'ia', img: 'imagem',
    weather: 'clima', tempo: 'clima', short: 'encurtar', curto: 'encurtar',
    premium: 'vip', dec: 'decrypt', vpn: 'decrypt', vpndec: 'decrypt',
  };
  if (aliasMap[commandName] && nativeCommands[aliasMap[commandName]]) {
    try {
      await reactions.reactStart(sock, msg, aliasMap[commandName]);
      await nativeCommands[aliasMap[commandName]]({ sock, msg, ctx, args, isOwner, fillVars: (t) => fillVars(t, ctx, currentPrefix), config });
      await reactions.reactSuccess(sock, msg, aliasMap[commandName]);
      await incrementUserCommand(ctx.senderNumber);
      return true;
    } catch (err) {
      await reactions.reactError(sock, msg, aliasMap[commandName]);
      await sock.sendMessage(ctx.remoteJid, { text: '❌ ' + err.message }, { quoted: msg });
      return true;
    }
  }

  try {
    const cmd = await Command.findOne({ $or: [{ name: commandName }, { aliases: commandName }], enabled: true });
    if (!cmd) return false;
    if (cmd.accessLevel === 'owner' && !isOwner) {
      await sock.sendMessage(ctx.remoteJid, { text: '🚫 Só Dono.' }, { quoted: msg }); return true;
    }
    if (cmd.accessLevel === 'premium') {
      const user = await User.findOne({ whatsappNumber: ctx.senderNumber });
      const isPrem = isOwner || (user && user.isPremium());
      if (!isPrem) {
        await sock.sendMessage(ctx.remoteJid, { text: `⭐ *Comando Premium*\n\nUse ${currentPrefix}vip\n📞 wa.me/${config.owner.number}` }, { quoted: msg });
        return true;
      }
    }
    cmd.usageCount = (cmd.usageCount || 0) + 1;
    await cmd.save();
    await reactions.reactStart(sock, msg, cmd.category || commandName);
    const responseText = fillVars(cmd.response || '', ctx, currentPrefix);
    if (cmd.mediaUrl && cmd.mediaType) {
      const buffer = await mediaHandler.fetchBuffer(cmd.mediaUrl);
      const payload = cmd.mediaType === 'image' || cmd.mediaType === 'gif'
        ? { image: buffer, caption: responseText }
        : cmd.mediaType === 'video' ? { video: buffer, caption: responseText }
        : cmd.mediaType === 'audio' ? { audio: buffer, mimetype: 'audio/mp4' }
        : { text: responseText };
      await sock.sendMessage(ctx.remoteJid, payload, { quoted: msg });
    } else if (responseText) {
      await sock.sendMessage(ctx.remoteJid, { text: responseText }, { quoted: msg });
    }
    await reactions.reactSuccess(sock, msg, cmd.category || commandName);
    await incrementUserCommand(ctx.senderNumber);
    return true;
  } catch (err) {
    console.error('DB cmd:', err);
    return false;
  }
}

async function handleDecryptRequest(sock, msg, ctx, docMsg, isOwner) {
  const user = await User.findOne({ whatsappNumber: ctx.senderNumber });
  const isPremium = isOwner || (user && user.isPremium());

  if (!isPremium) {
    await sock.sendMessage(ctx.remoteJid, {
      text: `🔓 *VPN DECRYPTER — Recurso Premium*\n\n` +
            `Para usar o decrypter, você precisa ser Premium.\n\n` +
            `💎 Veja os planos: ${config.bot.prefix}vip\n` +
            `📞 wa.me/${config.owner.number}`,
    }, { quoted: msg });
    return true;
  }

  await sock.sendMessage(ctx.remoteJid, { react: { text: '🔓', key: msg.key } });

  try {
    const buffer = await mediaHandler.downloadFromMessage(msg);
    const fileName = docMsg.fileName || 'arquivo.bin';
    const result = await decrypter.decrypt(fileName, buffer);
    const formatted = formatForWhatsApp(result, config);

    if (formatted.length > 4000) {
      const chunks = chunkString(formatted, 3800);
      for (const c of chunks) await sock.sendMessage(ctx.remoteJid, { text: c }, { quoted: msg });
    } else {
      await sock.sendMessage(ctx.remoteJid, { text: formatted }, { quoted: msg });
    }

    const jsonBuf = Buffer.from(JSON.stringify(result, null, 2), 'utf-8');
    await sock.sendMessage(ctx.remoteJid, {
      document: jsonBuf, fileName: `${fileName}.decrypted.json`, mimetype: 'application/json',
      caption: '📄 JSON completo da decryptação',
    }, { quoted: msg });

    await sock.sendMessage(ctx.remoteJid, { react: { text: '✅', key: msg.key } });

    try {
      await DecryptLog.create({
        user: user?._id, username: user?.username || ctx.pushName,
        whatsappNumber: ctx.senderNumber, fileName, format: result.format,
        source: 'whatsapp', success: true,
        extracted: { configName: result.configName, host: result.server?.host, port: result.server?.port },
      });
    } catch (e) {}
  } catch (err) {
    await sock.sendMessage(ctx.remoteJid, { react: { text: '❌', key: msg.key } });
    await sock.sendMessage(ctx.remoteJid, {
      text: `❌ *Erro ao decryptar*\n\n${err.message}\n\nFormatos suportados: .ehi, .ehic, .hat, .npv4, .dark, .any, .tls, .conf, .nm, .ovpn, .ssh, .json`,
    }, { quoted: msg });
    try {
      await DecryptLog.create({
        user: user?._id, username: user?.username || ctx.pushName,
        whatsappNumber: ctx.senderNumber, fileName: docMsg.fileName,
        source: 'whatsapp', success: false, error: err.message,
      });
    } catch (e) {}
  }
  return true;
}

function chunkString(str, size) {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) chunks.push(str.slice(i, i + size));
  return chunks;
}

async function incrementUserCommand(number) {
  try {
    const u = await User.findOne({ whatsappNumber: number });
    if (u) { u.commandsUsed = (u.commandsUsed || 0) + 1; await u.save(); }
  } catch (e) {}
}

async function handleStickerRequest(sock, msg, ctx) {
  try {
    await sock.sendMessage(ctx.remoteJid, { react: { text: '⏳', key: msg.key } });
    const buffer = await mediaHandler.downloadFromMessage(msg);
    const stk = await stickerMaker.create(buffer, {
      botName: config.bot.name, ownerName: config.owner.name,
      userName: ctx.pushName, groupName: ctx.groupName || 'Privado',
      isVideo: !!msg.message?.videoMessage,
    });
    await sock.sendMessage(ctx.remoteJid, { sticker: stk }, { quoted: msg });
    await sock.sendMessage(ctx.remoteJid, { react: { text: '✅', key: msg.key } });
  } catch (err) {
    await sock.sendMessage(ctx.remoteJid, { text: '❌ ' + err.message }, { quoted: msg });
  }
}

module.exports = { handle, extractText, getSenderInfo, fillVars };
