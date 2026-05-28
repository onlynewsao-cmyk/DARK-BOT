/**
 * Anti-Link + Anti-Spam v2
 * Configurável por grupo + warning system + delete + ban
 */
const BotConfig = require('../database/models/BotConfig');
const GroupSettings = require('../database/models/GroupSettings');
const config = require('../config');
const liveBroadcaster = require('./liveBroadcaster');

const userActivity = new Map();
const warnings = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of userActivity) {
    const filtered = (v || []).filter(t => now - t < 30000);
    if (filtered.length === 0) userActivity.delete(k);
    else userActivity.set(k, filtered);
  }
}, 60000);

const LINK_PATTERNS = {
  whatsapp: /chat\.whatsapp\.com\/[A-Za-z0-9]{10,}/i,
  url: /https?:\/\/[^\s<>]+/i,
  domain: /(?:^|\s)([a-z0-9-]+\.(?:com|net|org|io|me|xyz|info|tk|ml|ga|cf|gq|top|club|site|online|store|app|dev|co|us|br|pt|ao|mz|tv|ly|lol|gg|fun))\b/i,
};

function jidNumber(jid) {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0];
}

async function isBotAdmin(sock, groupJid) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    const myJid = sock.user?.id || '';
    const myNum = jidNumber(myJid);
    const myLid = sock.user?.lid ? jidNumber(sock.user.lid) : null;
    const p = meta.participants.find(x => {
      const n = jidNumber(x.id);
      return n === myNum || (myLid && n === myLid);
    });
    return p?.admin === 'admin' || p?.admin === 'superadmin';
  } catch { return false; }
}

async function isSenderAdmin(sock, groupJid, senderJid) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    const num = jidNumber(senderJid);
    const p = meta.participants.find(x => jidNumber(x.id) === num);
    return p?.admin === 'admin' || p?.admin === 'superadmin';
  } catch { return false; }
}

function detectLink(text, mode, whitelist) {
  if (!text) return null;
  if (whitelist && whitelist.length) {
    for (const allowed of whitelist) {
      if (text.toLowerCase().includes(allowed.toLowerCase())) return null;
    }
  }
  if (LINK_PATTERNS.whatsapp.test(text)) {
    return { type: 'whatsapp_group', match: text.match(LINK_PATTERNS.whatsapp)?.[0] };
  }
  if (mode === 'whatsapp_only') return null;
  if (LINK_PATTERNS.url.test(text)) {
    return { type: 'url', match: text.match(LINK_PATTERNS.url)?.[0] };
  }
  if (mode === 'all_links') {
    if (LINK_PATTERNS.domain.test(text)) {
      return { type: 'domain', match: text.match(LINK_PATTERNS.domain)?.[1] };
    }
  }
  return null;
}

async function check(sock, msg) {
  try {
    const remoteJid = msg.key.remoteJid;
    if (!remoteJid?.endsWith('@g.us')) return;
    const senderJid = msg.key.participant;
    const senderNumber = jidNumber(senderJid);
    if (!senderJid || senderNumber === jidNumber(config.owner.number)) return;

    const text = msg.message?.conversation
              || msg.message?.extendedTextMessage?.text
              || msg.message?.imageMessage?.caption
              || msg.message?.videoMessage?.caption
              || '';

    let groupSettings = await GroupSettings.findOne({ groupJid: remoteJid }).catch(() => null);
    const globalAntilink = await BotConfig.get('antilink_enabled', false).catch(() => false);
    const globalAntispam = await BotConfig.get('antispam_enabled', false).catch(() => false);

    const antilinkEnabled = (groupSettings?.antilink !== false && groupSettings?.antilink) || globalAntilink;
    if (antilinkEnabled && text) {
      const mode = groupSettings?.antilinkMode || 'smart';
      const whitelist = groupSettings?.antilinkWhitelist || [];
      const detection = detectLink(text, mode, whitelist);
      if (detection) {
        const senderIsAdmin = await isSenderAdmin(sock, remoteJid, senderJid);
        if (!senderIsAdmin) {
          const botAdmin = await isBotAdmin(sock, remoteJid);
          if (botAdmin) {
            await handleLinkViolation(sock, msg, senderJid, senderNumber, detection, groupSettings);
            return;
          } else {
            // Avisa apenas (não pode deletar)
            await sock.sendMessage(remoteJid, {
              text: `⚠️ Detectei link suspeito de @${senderNumber}, mas preciso ser admin pra deletar.`,
              mentions: [senderJid],
            }).catch(()=>{});
          }
        }
      }
    }

    const antispamEnabled = groupSettings?.antispam || globalAntispam;
    if (antispamEnabled) {
      await checkSpam(sock, msg, remoteJid, senderJid, senderNumber);
    }
  } catch (err) {
    console.error('antiSpam err:', err.message);
  }
}

async function handleLinkViolation(sock, msg, senderJid, senderNumber, detection, groupSettings) {
  try {
    await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });

    const key = `${msg.key.remoteJid}:${senderNumber}`;
    const w = (warnings.get(key) || 0) + 1;
    warnings.set(key, w);

    // Live broadcast
    liveBroadcaster.antilinkAction({
      group: msg.key.remoteJid,
      user: senderNumber,
      action: 'detected',
      type: detection.type,
      warns: w,
    });

    const action = groupSettings?.antilinkAction || 'warn';
    const maxWarns = groupSettings?.maxWarns || 3;

    if (action === 'kick' || w >= maxWarns) {
      try {
        await sock.groupParticipantsUpdate(msg.key.remoteJid, [senderJid], 'remove');
        await sock.sendMessage(msg.key.remoteJid, {
          text: `╔═══════════════════════════════╗\n` +
                `║  🚫 *ANTI-LINK SECURITY*  ║\n` +
                `╚═══════════════════════════════╝\n\n` +
                `▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱\n` +
                `👤 USER: @${senderNumber}\n` +
                `🔥 STATUS: *BANIDO*\n` +
                `📋 TIPO: ${detection.type.toUpperCase()}\n` +
                `⚠️ AVISOS: ${w}/${maxWarns}\n` +
                `▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱`,
          mentions: [senderJid],
        });
        warnings.delete(key);
      } catch (e) {
        console.error('Ban falhou:', e.message);
      }
    } else {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `╔═══════════════════════════════╗\n` +
              `║  ⚠️ *ANTI-LINK DETECTED*  ║\n` +
              `╚═══════════════════════════════╝\n\n` +
              `▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱\n` +
              `👤 USER: @${senderNumber}\n` +
              `📋 TIPO: ${detection.type.toUpperCase()}\n` +
              `🚨 AVISO: *${w}/${maxWarns}*\n` +
              `▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱\n\n` +
              `_Próxima vez = BAN automático_`,
        mentions: [senderJid],
      });
    }
  } catch (e) {
    console.error('handleLinkViolation:', e.message);
  }
}

async function checkSpam(sock, msg, remoteJid, senderJid, senderNumber) {
  const now = Date.now();
  const acts = userActivity.get(senderJid) || [];
  const recent = acts.filter(t => now - t < 5000);
  recent.push(now);
  userActivity.set(senderJid, recent);

  if (recent.length >= 5) {
    const senderIsAdmin = await isSenderAdmin(sock, remoteJid, senderJid);
    if (senderIsAdmin) return;
    const botAdmin = await isBotAdmin(sock, remoteJid);
    if (!botAdmin) return;

    const key = `${remoteJid}:${senderNumber}:spam`;
    const w = (warnings.get(key) || 0) + 1;
    warnings.set(key, w);

    if (w >= 3) {
      try {
        await sock.groupParticipantsUpdate(remoteJid, [senderJid], 'remove');
        await sock.sendMessage(remoteJid, {
          text: `🚫 @${senderNumber} *BANIDO* por SPAM (${w} avisos)`,
          mentions: [senderJid],
        });
        warnings.delete(key);
      } catch (e) {}
    } else {
      await sock.sendMessage(remoteJid, {
        text: `⚠️ @${senderNumber} pare de fazer spam! Aviso *${w}/3*`,
        mentions: [senderJid],
      }).catch(()=>{});
    }
    userActivity.set(senderJid, []);
  }
}

module.exports = { check, detectLink };
