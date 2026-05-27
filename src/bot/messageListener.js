/**
 * Listener de mensagens para:
 * - Anti-delete (salvar mensagens antes que sejam apagadas)
 * - Modo espião (emite tudo pro dashboard)
 */
const DeletedMessage = require('../database/models/DeletedMessage');
const BotConfig = require('../database/models/BotConfig');

// Cache de mensagens recentes (para recuperar quando apagadas)
const messageCache = new Map();
const MAX_CACHE = 2000;

function extractText(msg) {
  const m = msg.message;
  return m?.conversation || m?.extendedTextMessage?.text ||
    m?.imageMessage?.caption || m?.videoMessage?.caption ||
    m?.documentMessage?.caption || '';
}

function detectMediaType(msg) {
  const m = msg.message;
  if (m?.imageMessage) return 'image';
  if (m?.videoMessage) return 'video';
  if (m?.audioMessage) return 'audio';
  if (m?.documentMessage) return 'document';
  if (m?.stickerMessage) return 'sticker';
  return '';
}

async function onUpsert(sock, m, io) {
  try {
    const msg = m.messages?.[0];
    if (!msg || !msg.message || msg.key.fromMe) return;

    const remoteJid = msg.key.remoteJid;
    const fromJid = remoteJid?.endsWith('@g.us') ? msg.key.participant : remoteJid;
    const fromNumber = fromJid?.split('@')[0] || '';

    // Cache em memória
    if (messageCache.size > MAX_CACHE) {
      const firstKey = messageCache.keys().next().value;
      messageCache.delete(firstKey);
    }
    messageCache.set(msg.key.id, msg);

    // Anti-delete: salva no MongoDB (TTL 7d)
    const antideleteOn = await BotConfig.get('antidelete_enabled', false).catch(() => false);
    if (antideleteOn) {
      try {
        await DeletedMessage.findOneAndUpdate(
          { messageId: msg.key.id },
          {
            messageId: msg.key.id,
            groupJid: remoteJid?.endsWith('@g.us') ? remoteJid : '',
            fromJid, fromNumber, fromName: msg.pushName || '',
            text: extractText(msg), mediaType: detectMediaType(msg),
            raw: msg,
          },
          { upsert: true }
        );
      } catch (e) {}
    }

    // Espião
    const spyOn = await BotConfig.get('spy_enabled', false).catch(() => false);
    if (spyOn && io) {
      io.emit('bot:spy', {
        time: new Date().toISOString(),
        from: msg.pushName || fromNumber,
        group: remoteJid?.endsWith('@g.us') ? remoteJid : 'PV',
        text: extractText(msg).slice(0, 200),
        media: detectMediaType(msg),
      });
    }
  } catch (e) { console.error('messageListener:', e); }
}

async function onDelete(sock, update, io) {
  try {
    const antideleteOn = await BotConfig.get('antidelete_enabled', false).catch(() => false);
    if (!antideleteOn) return;

    const ownerNum = require('../config').owner.number;
    const ownerJid = ownerNum + '@s.whatsapp.net';

    for (const item of update) {
      if (!item.key?.id) continue;
      const saved = await DeletedMessage.findOne({ messageId: item.key.id });
      if (!saved) continue;
      saved.deletedAt = new Date();
      await saved.save();

      // Envia pro dono em PV
      const groupName = item.key.remoteJid?.endsWith('@g.us') ? `(grupo ${item.key.remoteJid})` : '(PV)';
      const text = `👻 *MSG APAGADA RECUPERADA*\n\n` +
                   `👤 De: ${saved.fromName || saved.fromNumber}\n` +
                   `📍 Onde: ${groupName}\n` +
                   `🕐 Quando: ${new Date().toLocaleString('pt-BR')}\n\n` +
                   `💬 *Conteúdo:*\n${saved.text || '[' + saved.mediaType + ']'}`;
      try { await sock.sendMessage(ownerJid, { text }); } catch (e) {}
      if (io) io.emit('bot:deleted', { from: saved.fromName, text: saved.text, time: new Date() });
    }
  } catch (e) { console.error('onDelete:', e); }
}

module.exports = { onUpsert, onDelete, messageCache };
