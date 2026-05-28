/**
 * APNA Tunnel Lite (apnalite://)
 * Mesmo formato base que BD Net VPN (mesmo SDK).
 */
const crypto = require('crypto');
const zlib = require('zlib');
const { utilExtractStrings } = require('./_util');

const KNOWN_XOR_KEYS = [
  Buffer.from('ApnaLite'), Buffer.from('APNATUNNEL'),
  Buffer.from('apnaliteVPN'), Buffer.from('ApnaTunnelLite'),
  Buffer.from('YOURUNIQUEKEY'),
  Buffer.from([0x41, 0x50, 0x4e, 0x41]),
];
const KNOWN_AES_KEYS = [
  'ApnaTunnelLiteSecretKey2024',
  'apnatunnellitekey',
  'APNATunnelEncryptKey',
];

function hexToBuffer(s) {
  let h = s.replace(/^apnalite:\/\//i, '').replace(/^apna:\/\//i, '').trim().replace(/\s+/g, '');
  if (!/^[0-9a-f]+$/i.test(h)) throw new Error('Conteúdo APNA Lite inválido (não é hex)');
  if (h.length % 2 !== 0) h = h.slice(0, h.length - 1);
  return Buffer.from(h, 'hex');
}

function tryXor(buffer, key) {
  const out = Buffer.alloc(buffer.length);
  for (let i = 0; i < buffer.length; i++) out[i] = buffer[i] ^ key[i % key.length];
  return out;
}

function tryAes(encrypted, password, iv = Buffer.alloc(16, 0)) {
  try {
    const key = crypto.createHash('sha256').update(password).digest();
    const d = crypto.createDecipheriv('aes-256-cbc', key, iv);
    d.setAutoPadding(true);
    return Buffer.concat([d.update(encrypted), d.final()]);
  } catch (e) { return null; }
}

function ratio(buffer) {
  if (!buffer || buffer.length === 0) return 0;
  let p = 0;
  for (const b of buffer) if (b >= 32 && b <= 126) p++;
  return p / buffer.length;
}

async function parse(input, fileName) {
  let raw;
  if (Buffer.isBuffer(input)) {
    const s = input.toString('utf-8').trim();
    raw = (s.startsWith('apnalite://') || s.startsWith('apna://')) ? hexToBuffer(s) : input;
  } else {
    raw = hexToBuffer(String(input));
  }

  const header = raw.slice(0, 40);
  const body = raw.slice(40);

  let decrypted = null;
  let usedKey = null;

  for (const key of KNOWN_XOR_KEYS) {
    const dec = tryXor(body, key);
    if (ratio(dec) > 0.7) { decrypted = dec; usedKey = `XOR:${key.toString('utf-8')}`; break; }
  }

  if (!decrypted) {
    for (const pwd of KNOWN_AES_KEYS) {
      const dec = tryAes(body, pwd);
      if (dec && ratio(dec) > 0.6) { decrypted = dec; usedKey = `AES:${pwd}`; break; }
    }
  }

  if (!decrypted) {
    try { decrypted = zlib.gunzipSync(body); } catch (e) {}
  }

  const allStrings = utilExtractStrings(raw, 4);
  const interesting = allStrings.filter(s =>
    /\.com|\.net|\.org|\.io|\.xyz|ssh|proxy|host|port|user|pass|sni|payload|http/i.test(s)
  );

  let data = {};
  if (decrypted) {
    const s = decrypted.toString('utf-8');
    const json = s.match(/\{[\s\S]*\}/);
    if (json) { try { data = JSON.parse(json[0]); } catch (e) {} }
    const hostMatch = s.match(/(?:host|server|proxy)[\s:=]+([a-zA-Z0-9.-]+\.[a-z]{2,})/i);
    const portMatch = s.match(/(?:port)[\s:=]+(\d{1,5})/i);
    const userMatch = s.match(/(?:user|username|login)[\s:=]+([a-zA-Z0-9._-]+)/i);
    const passMatch = s.match(/(?:pass|password|pwd)[\s:=]+([^\s,;}]+)/i);
    if (hostMatch) data.host = hostMatch[1];
    if (portMatch) data.port = portMatch[1];
    if (userMatch) data.user = userMatch[1];
    if (passMatch) data.pass = passMatch[1];
  }

  return {
    configName: fileName?.replace(/\.(apnalite|apna|txt)$/i, '') || 'APNA Lite Config',
    configType: 'APNA Tunnel Lite',
    appName: 'APNA Tunnel Lite',
    mode: 'SSH/Tunnel',
    host: data.host || '',
    port: data.port || '',
    ssh: {
      host: data.ssh_host || data.host || '',
      port: data.ssh_port || '443',
      user: data.ssh_user || data.user || '',
      pass: data.ssh_pass || data.pass || '',
    },
    sni: data.sni || '',
    payload: data.payload || '',
    note: decrypted
      ? `✅ Decryptado parcialmente com ${usedKey}`
      : `⚠️ APNA Lite usa criptografia proprietária.\n` +
        `Foram extraídas ${interesting.length} strings interessantes.`,
    raw: {
      totalBytes: raw.length,
      headerHex: header.toString('hex'),
      headerNote: 'Mesmo header que BD Net (SDK compartilhado)',
      interestingStrings: interesting,
      allStrings: allStrings.slice(0, 30),
      decryptionAttempt: usedKey || 'nenhuma key conhecida funcionou',
    },
    allFields: data,
  };
}

module.exports = { parse };
