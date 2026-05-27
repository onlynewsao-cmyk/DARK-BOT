const BotConfig = require('../database/models/BotConfig');
const config = require('../config');

const userActivity = new Map(); // jid -> [timestamps]
const warnings = new Map(); // jid -> count

async function check(sock, msg) {
  try {
    const remoteJid = msg.key.remoteJid;
    if (!remoteJid?.endsWith('@g.us')) return; // só grupos

    const senderJid = msg.key.participant;
    const senderNumber = senderJid?.split('@')[0];
    if (!senderJid || senderNumber === config.owner.number) return;

    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

    const antilinkEnabled = await BotConfig.get('antilink_enabled', false);
    const antispamEnabled = await BotConfig.get('antispam_enabled', false);

    // ANTILINK
    if (antilinkEnabled && /https?:\/\/|chat\.whatsapp\.com|wa\.me/i.test(text)) {
      const meta = await sock.groupMetadata(remoteJid).catch(() => null);
      if (!meta) return;
      const sender = meta.participants.find(p => p.id === senderJid);
      if (sender?.admin) return; // admins podem
      const me = sock.user.id.split(':')[0] + '@s.whatsapp.net';
      const botIsAdmin = meta.participants.find(p => p.id === me)?.admin;
      if (!botIsAdmin) return;

      try {
        await sock.sendMessage(remoteJid, { delete: msg.key });
        await sock.sendMessage(remoteJid, {
          text: `🚫 *ANTI-LINK*\n\n@${senderNumber} foi removido por enviar link.`,
          mentions: [senderJid],
        });
        await sock.groupParticipantsUpdate(remoteJid, [senderJid], 'remove');
      } catch (e) {}
      return;
    }

    // ANTISPAM (5 msgs em 5s)
    if (antispamEnabled) {
      const now = Date.now();
      const acts = userActivity.get(senderJid) || [];
      const recent = acts.filter(t => now - t < 5000);
      recent.push(now);
      userActivity.set(senderJid, recent);

      if (recent.length >= 5) {
        const meta = await sock.groupMetadata(remoteJid).catch(() => null);
        const sender = meta?.participants.find(p => p.id === senderJid);
        if (sender?.admin) return;
        const me = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        if (!meta?.participants.find(p => p.id === me)?.admin) return;

        const w = (warnings.get(senderJid) || 0) + 1;
        warnings.set(senderJid, w);
        if (w >= 3) {
          try {
            await sock.sendMessage(remoteJid, {
              text: `🚫 @${senderNumber} foi removido por SPAM (3 avisos).`,
              mentions: [senderJid],
            });
            await sock.groupParticipantsUpdate(remoteJid, [senderJid], 'remove');
            warnings.delete(senderJid);
          } catch (e) {}
        } else {
          await sock.sendMessage(remoteJid, {
            text: `⚠️ @${senderNumber} pare de fazer spam! Aviso ${w}/3`,
            mentions: [senderJid],
          }).catch(() => {});
        }
        userActivity.set(senderJid, []);
      }
    }
  } catch (err) { console.error('antiSpam:', err); }
}

module.exports = { check };
