/**
 * NPV Tunnel (.npv4 / .npv7 / .npv8 / .npv)
 * Estrutura: header binário + base64 + AES + JSON
 */
const crypto = require('crypto');
const zlib = require('zlib');

const NPV_KEYS = [
  'NPVTunnel2021KeySecret',
  'npv_tunnel_secret_key',
  'NPVAESKEY123456789NPVTUNNEL',
  '12345678901234567890123456789012',
  'npvtunnel4secretkey1234567890123',
];

const IV = Buffer.alloc(16, 0);

function tryAES(b64, key) {
  try {
    const data = Buffer.from(b64, 'base64');
    const keyBuf = crypto.createHash('sha256').update(key).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, IV);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf-8');
  } catch (e) { return null; }
}

async function parse(buffer, fileName) {
  let json = null;

  // 1) Strip headers comuns (NPV4, NPV7, NPV8)
  let body = buffer;
  const head4 = buffer.slice(0, 4).toString();
  if (['NPV4','NPV7','NPV8'].includes(head4)) body = buffer.slice(4);
  else if (buffer.slice(0,3).toString() === 'NPV') body = buffer.slice(3);

  // 2) JSON direto
  try {
    const s = body.toString('utf-8');
    const idx = s.indexOf('{');
    if (idx >= 0) {
      const cand = s.slice(idx, s.lastIndexOf('}') + 1);
      JSON.parse(cand);
      json = cand;
    }
  } catch (e) {}

  // 3) AES + variações
  if (!json) {
    const b64 = body.toString('utf-8').trim();
    for (const k of NPV_KEYS) {
      const r = tryAES(b64, k);
      if (r && r.includes('{')) { json = r; break; }
    }
  }

  // 4) Gzip
  if (!json) { try { json = zlib.gunzipSync(body).toString('utf-8'); } catch (e) {} }

  // 5) Base64 puro
  if (!json) {
    try {
      const dec = Buffer.from(body.toString('utf-8').trim(), 'base64');
      const s = dec.toString('utf-8');
      if (s.includes('{')) json = s;
    } catch (e) {}
  }

  if (!json) {
    return {
      configName: fileName.replace(/\.npv\d*$/i, ''),
      configType: 'NPV Tunnel',
      appName: 'NPV Tunnel',
      note: '⚠️ Não decriptado completamente',
      allFields: { extractedStrings: extractStrings(body) },
    };
  }

  let data;
  try { data = JSON.parse(json.match(/\{[\s\S]*\}/)?.[0] || json); }
  catch (e) { data = { raw: json }; }

  return parseNpvJson(data, fileName);
}

function parseNpvJson(data, fileName) {
  const find = (...keys) => {
    for (const k of keys) {
      if (data[k] !== undefined && data[k] !== null && data[k] !== '') return data[k];
      const lk = Object.keys(data).find(x => x.toLowerCase() === k.toLowerCase());
      if (lk && data[lk]) return data[lk];
    }
    return '';
  };

  return {
    configName: find('name', 'configName', 'profile_name') || fileName.replace(/\.npv\d*$/i, ''),
    configType: 'NPV Tunnel',
    appName: 'NPV Tunnel',
    mode: find('mode', 'connection_mode'),
    note: find('note', 'description'),

    host: find('proxy_host', 'host', 'server_host', 'remote_host'),
    port: find('proxy_port', 'port', 'server_port'),

    ssh: {
      host: find('ssh_host', 'sshHost'),
      port: find('ssh_port', 'sshPort'),
      user: find('ssh_user', 'ssh_username', 'username'),
      pass: find('ssh_pass', 'ssh_password', 'password'),
    },

    proxy: {
      host: find('proxy_host'),
      port: find('proxy_port'),
      type: find('proxy_type') || 'HTTP',
      user: find('proxy_user', 'proxy_username'),
      pass: find('proxy_pass', 'proxy_password'),
    },

    payload: find('payload', 'custom_payload', 'request_payload'),
    payloadMethod: find('payload_method'),

    sni: find('sni', 'sni_host', 'ssl_sni'),

    dns: [find('dns')].filter(Boolean),

    raw: data,
    allFields: data,
  };
}

function extractStrings(buffer, minLen = 6) {
  const result = [];
  let cur = '';
  for (const b of buffer) {
    if (b >= 32 && b <= 126) cur += String.fromCharCode(b);
    else { if (cur.length >= minLen) result.push(cur); cur = ''; }
  }
  if (cur.length >= minLen) result.push(cur);
  return result.slice(0, 200);
}

module.exports = { parse };
