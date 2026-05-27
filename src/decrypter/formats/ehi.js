/**
 * HTTP Injector (.ehi / .ehic)
 * Estrutura: 4 bytes mágicos "HTTP" + payload AES + base64 + JSON criptografado
 * Versões diferentes usam keys diferentes. Lista das keys conhecidas (públicas).
 */
const crypto = require('crypto');
const zlib = require('zlib');

const KNOWN_KEYS = [
  // Keys públicas conhecidas do HTTP Injector (várias versões)
  'NDk2MTQ4NDg3NjQ5NjY0OTYzNjY2NDQ5NDg=', // base64 antiga
  '6f188e62d3669f60b923d8624628a87e',
  '8742c83a5d8af7e25b96e1a93b73c3a0',
  '7a4d2a4f4f7e0c2b8c3a5d1f3e9a8b6c',
  'b7e151628aed2a6abf7158809cf4f3c7',
  // Algumas versões usam essas:
  'd6b66fa97a7d9a2f0e7c4f3a2b1d8e5c',
  'e3a8b2c5d4f7e9a1b3c6d8f0a2e4b7c9',
];

const IV = Buffer.alloc(16, 0);

function tryAES(encryptedB64, keyHex) {
  try {
    const data = Buffer.from(encryptedB64, 'base64');
    const key = Buffer.from(keyHex, 'hex').length === 32 ? Buffer.from(keyHex, 'hex') : crypto.createHash('sha256').update(keyHex).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, IV);
    decipher.setAutoPadding(true);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString('utf-8');
  } catch (e) { return null; }
}

function tryAESVariations(b64) {
  // Tenta múltiplas variações
  for (const k of KNOWN_KEYS) {
    const r = tryAES(b64, k);
    if (r && r.includes('{')) return r;
  }
  // Tenta AES-128 também
  for (const k of KNOWN_KEYS) {
    try {
      const data = Buffer.from(b64, 'base64');
      const key = crypto.createHash('md5').update(k).digest();
      const decipher = crypto.createDecipheriv('aes-128-cbc', key, IV);
      const dec = Buffer.concat([decipher.update(data), decipher.final()]);
      const s = dec.toString('utf-8');
      if (s.includes('{')) return s;
    } catch (e) {}
  }
  return null;
}

function tryBase64Direct(buffer) {
  // Algumas versões antigas são só base64 + JSON
  try {
    const s = buffer.toString('utf-8').trim();
    // Remove magic bytes "HTTP" se houver
    const cleaned = s.startsWith('HTTP') ? s.slice(4) : s;
    const decoded = Buffer.from(cleaned, 'base64').toString('utf-8');
    if (decoded.includes('{')) return decoded;
  } catch (e) {}
  return null;
}

function tryGzip(buffer) {
  try {
    const dec = zlib.gunzipSync(buffer.slice(4)); // pula magic bytes
    return dec.toString('utf-8');
  } catch (e) { return null; }
}

function tryRawJson(buffer) {
  try {
    const s = buffer.toString('utf-8');
    if (s.trim().startsWith('{')) return s;
    // Procura JSON dentro do binário
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const candidate = s.slice(start, end + 1);
      JSON.parse(candidate);
      return candidate;
    }
  } catch (e) {}
  return null;
}

async function parse(buffer, fileName) {
  let json = null;

  // 1) JSON direto
  json = tryRawJson(buffer);
  // 2) Base64 puro
  if (!json) json = tryBase64Direct(buffer);
  // 3) Gzip
  if (!json) json = tryGzip(buffer);
  // 4) AES variations
  if (!json) {
    const b64 = buffer.toString('utf-8').replace(/^HTTP/, '').trim();
    json = tryAESVariations(b64);
  }

  if (!json) {
    // Última tentativa: extrai strings legíveis
    const strings = extractStrings(buffer);
    return {
      configName: fileName.replace(/\.(ehi|ehic)$/i, ''),
      configType: 'HTTP Injector',
      appName: 'HTTP Injector',
      note: '⚠️ Não foi possível decriptar completamente. Strings extraídas abaixo.',
      raw: strings,
      allFields: { extractedStrings: strings },
    };
  }

  const data = JSON.parse(json);
  return parseEhiJson(data, fileName);
}

function parseEhiJson(data, fileName) {
  // Procura campos comuns em vários níveis
  const find = (...keys) => {
    for (const k of keys) {
      if (data[k] !== undefined && data[k] !== null && data[k] !== '') return data[k];
      // procura case-insensitive
      const lk = Object.keys(data).find(x => x.toLowerCase() === k.toLowerCase());
      if (lk && data[lk]) return data[lk];
    }
    return '';
  };

  return {
    configName: find('config_name', 'name', 'profileName') || fileName.replace(/\.(ehi|ehic)$/i, ''),
    configType: 'HTTP Injector',
    appName: 'HTTP Injector',
    mode: find('connection_mode', 'mode', 'connectionType'),
    note: find('config_note', 'note', 'notes'),

    host: find('proxy_ip', 'proxy_host', 'host', 'remote_proxy'),
    port: find('proxy_port', 'port'),

    ssh: {
      host: find('ssh_host', 'sshHost'),
      port: find('ssh_port', 'sshPort'),
      user: find('ssh_username', 'username', 'ssh_user'),
      pass: find('ssh_password', 'password', 'ssh_pass'),
    },

    proxy: {
      host: find('proxy_ip', 'proxy_host'),
      port: find('proxy_port'),
      type: find('proxy_type') || 'HTTP',
      user: find('proxy_username', 'proxy_user'),
      pass: find('proxy_password', 'proxy_pass'),
    },

    payload: find('payload', 'request_payload', 'pre_payload', 'remote_payload'),
    payloadMethod: find('payload_method', 'method'),

    sni: find('sni', 'sni_host', 'ssl_sni'),

    udpgw: find('udpgw', 'udpgw_host'),

    dns: [find('dns', 'dns_server')].filter(Boolean),

    raw: data,
    allFields: data,
  };
}

function extractStrings(buffer, minLen = 6) {
  const result = [];
  let cur = '';
  for (const b of buffer) {
    if (b >= 32 && b <= 126) cur += String.fromCharCode(b);
    else {
      if (cur.length >= minLen) result.push(cur);
      cur = '';
    }
  }
  if (cur.length >= minLen) result.push(cur);
  return result.slice(0, 200);
}

module.exports = { parse };
