const Schedule = require('../database/models/Schedule');
const mediaHandler = require('./mediaHandler');
const { getBot } = require('./whatsapp');

let interval = null;

function start() {
  if (interval) return;
  interval = setInterval(tick, 30000); // checa a cada 30s
  console.log('⏰ Scheduler iniciado');
}

async function tick() {
  try {
    const now = new Date();
    const due = await Schedule.find({ scheduledFor: { $lte: now }, sent: false });
    for (const item of due) {
      await send(item);
    }
    // Recorrentes
    const recurring = await Schedule.find({ repeat: { $ne: 'none' }, sent: true });
    for (const item of recurring) {
      const last = item.lastSentAt || item.scheduledFor;
      const next = nextRunAt(last, item.repeat);
      if (next && next <= now) {
        await send(item, true);
      }
    }
  } catch (err) { console.error('Scheduler tick:', err); }
}

async function send(item, recurring = false) {
  const bot = getBot();
  if (!bot.sock || bot.connectionStatus !== 'connected') return;
  try {
    if (item.mediaUrl && item.mediaType) {
      const buf = await mediaHandler.fetchBuffer(item.mediaUrl);
      const payload = item.mediaType === 'image' || item.mediaType === 'gif' ? { image: buf, caption: item.message }
        : item.mediaType === 'video' ? { video: buf, caption: item.message }
        : item.mediaType === 'audio' ? { audio: buf, mimetype: 'audio/mp4' }
        : { text: item.message };
      await bot.sock.sendMessage(item.targetJid, payload);
    } else {
      await bot.sock.sendMessage(item.targetJid, { text: item.message });
    }
    item.sent = true;
    item.lastSentAt = new Date();
    await item.save();
    bot.log('success', `📅 Agendamento enviado: ${item.title}`);
  } catch (err) {
    bot.log('error', `Agendamento falhou: ${err.message}`);
  }
}

function nextRunAt(last, repeat) {
  const d = new Date(last);
  switch (repeat) {
    case 'daily': d.setDate(d.getDate() + 1); break;
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    default: return null;
  }
  return d;
}

module.exports = { start };
