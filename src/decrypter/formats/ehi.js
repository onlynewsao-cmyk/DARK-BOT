/**
 * HTTP Injector (.ehi / .ehic) v3
 *
 * Versões suportadas:
 * - v3.x - v5.x: Base64 puro de JSON
 * - v5.x - v6.x: AES com várias chaves conhecidas
 * - v6.x+: ZIP/Gzip wrappers
 */
const crypto = require('crypto');
const zlib = require('zlib');

const KNOWN_KEYS = [
  '6f188e62d3669f60b923d8624628a87e',
  '8742c83a5d8af7e25b96e1a93b73c3a0',
  '7a4d2a4f4f7e0c2b8c3a5d1f3e9a8b6c',
  'b7e151628aed2a6abf7158809cf4f3c7',
  'd6b66fa97a7d9a2f0e7c4f3a2b1d8e5c',
  'e3a8b2c5d4f7e9a1b3c6d8f0a2e4b7c9',
  '4961484876496649636644494862F8',
  'NWE0VAhBHmQVUlUTAQEAAhMAEgcKVAo',
  'a8a4f87e1c1d3df21f5e3a3b8b4c1d2e',
  'HTTPInjectorAndroidAES2020SecretKey',
  'HTTPInjectorEHIDecryptKey2024',
  'EvozyHTTPInjectorKey',
  'evozyAndroidAesKey2022!',
];

const IV = Buffer.alloc(16, 0);

function ratio(buf) {
  if (!buf || buf.length === 0) return 0;
  let p = 0;
  for (const b of buf) if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) p++;
  return p / buf.length;
}

function tryAES(encrypted, keyMaterial, iv = IV, mode = 'aes-256-cbc') {
  try {
    let key;
    if (Buffer.isBuffer(keyMaterial)) key = keyMaterial;
    else if (/^[0-9a-f]{32}$/i.test(keyMaterial)) key = Buffer.from(keyMaterial, 'hex');
    else if (/^[0-9a-f]{64}$/i.test(keyMaterial)) key = Buffer.from(keyMaterial, 'hex');
    else if (mode === 'aes-128-cbc') key = crypto.createHash('md5').update(keyMaterial).digest();
    else key = crypto.createHash('sha256').update(keyMaterial).digest();

    if (mode === 'aes-128-cbc' && key.length > 16) key = key.slice(0, 16);

    const d = crypto.createDecipheriv(mode, key, iv);
    d.setAutoPadding(true);
    return Buffer.concat([d.update(encrypted), d.final()]);
  } catch (e) { return null; }
}

function tryBase64Direct(buffer) {
  try {
    const s = buffer.toString('utf-8').trim();
    const cleaned = s.startsWith('HTTP') ? s.slice(4) : s;
    const decoded = Buffer.from(cleaned, 'base64');
    if (decoded.length > 10 && (decoded.toString('utf-8').includes('{') || ratio(decoded) > 0.5)) {
      return decoded.toString('utf-8');
    }
  } catch (e) {}
  return null;
}

function tryGzip(buffer, skipBytes = 0) {
  try {
    const dec = zlib.gunzipSync(buffer.slice(skipBytes));
    return dec.toString('utf-8');
  } catch (e) { return null; }
}

function tryRawJson(buffer) {
  try {
    const s = buffer.toString('utf-8');
    if (s.trim().startsWith('{')) return s;
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
  let jsonText = null;

  // 1) JSON direto (várias versões antigas armazenam plain)
  jsonText = tryRawJson(buffer);

  // 2) Base64 puro (v3-v5)
  if (!jsonText) jsonText = tryBase64Direct(buffer);

  // 3) Gzip (algumas versões)
  if (!jsonText) {
    jsonText = tryGzip(buffer);
    if (!jsonText) jsonText = tryGzip(buffer, 4); // pula magic bytes
  }

  // 4) AES com múltiplas variações
  if (!jsonText) {
    const variations = [
      buffer,                                                  // bytes direto
      Buffer.from(buffer.toString('utf-8').trim(), 'base64'),  // base64 → bytes
    ];
    const startIvs = [
      IV,
      buffer.slice(0, 16),                                     // IV no início
      Buffer.from('0102030405060708090a0b0c0d0e0f10', 'hex'),
    ];

    outer: for (const data of variations) {
      if (data.length < 16) continue;
      for (const key of KNOWN_KEYS) {
        for (const iv of startIvs) {
          for (const mode of ['aes-256-cbc', 'aes-128-cbc']) {
            const dec = tryAES(data, key, iv, mode);
            if (dec && ratio(dec) > 0.7) {
              const s = dec.toString('utf-8');
              if (s.includes('{')) { jsonText = s; break outer; }
            }
          }
        }
      }
    }
  }

  // Se não conseguiu, extrai strings
  if (!jsonText) {
    const strings = extractStrings(buffer);
    return {
      configName: fileName.replace(/\.(ehi|ehic)$/i, ''),
      configType: 'HTTP Injector (não decryptado)',
      appName: 'HTTP Injector',
      note: '⚠️ Não foi possível decryptar com as keys conhecidas.\n' +
            'Esta pode ser uma versão muito nova ou personalizada do HTTP Injector.\n' +
            `Strings extraídas: ${strings.length} fragmentos legíveis.`,
      raw: strings.slice(0, 50),
      allFields: { extractedStrings: strings.slice(0, 100) },
    };
  }

  // Parse JSON
  let data;
  try {
    const match = jsonText.match(/\{[\s\S]*\}/);
    data = JSON.parse(match ? match[0] : jsonText);
  } catch (e) {
    return {
      configName: fileName.replace(/\.(ehi|ehic)$/i, ''),
      configType: 'HTTP Injector',
      note: '⚠️ JSON decryptado mas malformado',
      raw: jsonText.slice(0, 2000),
    };
  }

  return parseEhiJson(data, fileName);
}

function parseEhiJson(data, fileName) {
  // Busca recursiva por campos (case-insensitive)
  const find = (...keys) => {
    for (const k of keys) {
      if (data[k] !== undefined && data[k] !== null && data[k] !== '') return data[k];
      const lk = Object.keys(data).find(x => x.toLowerCase() === k.toLowerCase());
      if (lk && data[lk]) return data[lk];
    }
    // Procura em sub-objetos
    for (const objKey of Object.keys(data)) {
      const child = data[objKey];
      if (child && typeof child === 'object' && !Array.isArray(child)) {
        for (const k of keys) {
          if (child[k] !== undefined && child[k] !== '' && child[k] !== null) return child[k];
        }
      }
    }
    return '';
  };

  return {
    configName: find('config_name', 'name', 'profileName', 'configName') || fileName.replace(/\.(ehi|ehic)$/i, ''),
    configType: 'HTTP Injector',
    appName: 'HTTP Injector',
    mode: find('connection_mode', 'mode', 'connectionType'),
    note: find('config_note', 'note', 'notes', 'description'),

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

    payload: find('payload', 'request_payload', 'pre_payload', 'remote_payload', 'custom_payload'),
    payloadMethod: find('payload_method', 'method'),

    sni: find('sni', 'sni_host', 'ssl_sni', 'serverName'),
    tlsVersion: find('tls_version'),

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
