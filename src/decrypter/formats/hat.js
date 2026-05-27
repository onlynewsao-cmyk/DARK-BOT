/**
 * HA Tunnel Plus (.hat)
 * Estrutura: assinatura "HAT" + bytes XOR + JSON
 * Usa chave XOR fixa em algumas versões
 */
const zlib = require('zlib');

const XOR_KEYS = [
  Buffer.from('hatunelplus2020'),
  Buffer.from('HATunnel@2021'),
  Buffer.from('ha_tunnel_plus_secret_key'),
  Buffer.from([0x48, 0x41, 0x54, 0x55, 0x4E, 0x4E, 0x45, 0x4C, 0x50, 0x4C, 0x55, 0x53]),
];

function xorDecrypt(buffer, key) {
  const out = Buffer.alloc(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    out[i] = buffer[i] ^ key[i % key.length];
  }
  return out;
}

async function parse(buffer, fileName) {
  let body = buffer;
  // Remove magic bytes "HAT" se presentes
  const head = buffer.slice(0, 3).toString();
  if (head === 'HAT') body = buffer.slice(3);

  let json = null;

  // 1) Tenta JSON direto
  try {
    const s = body.toString('utf-8');
    const idx = s.indexOf('{');
    if (idx >= 0) {
      const cand = s.slice(idx, s.lastIndexOf('}') + 1);
      JSON.parse(cand);
      json = cand;
    }
  } catch (e) {}

  // 2) Gzip
  if (!json) {
    try { json = zlib.gunzipSync(body).toString('utf-8'); } catch (e) {}
  }

  // 3) XOR variations
  if (!json) {
    for (const k of XOR_KEYS) {
      try {
        const dec = xorDecrypt(body, k);
        const s = dec.toString('utf-8');
        const idx = s.indexOf('{');
        if (idx >= 0) {
          const cand = s.slice(idx, s.lastIndexOf('}') + 1);
          JSON.parse(cand);
          json = cand;
          break;
        }
        // Tenta gzip após XOR
        const gz = zlib.gunzipSync(dec);
        json = gz.toString('utf-8');
        break;
      } catch (e) {}
    }
  }

  // 4) Base64
  if (!json) {
    try {
      const dec = Buffer.from(body.toString('utf-8'), 'base64');
      const s = dec.toString('utf-8');
      if (s.includes('{')) json = s;
    } catch (e) {}
  }

  if (!json) {
    return {
      configName: fileName.replace(/\.hat$/i, ''),
      configType: 'HA Tunnel Plus',
      appName: 'HA Tunnel Plus',
      note: '⚠️ Decryptação parcial — versão pode ser nova',
      allFields: { extractedStrings: extractStrings(body) },
    };
  }

  let data;
  try { data = JSON.parse(json); }
  catch (e) {
    return {
      configName: fileName.replace(/\.hat$/i, ''),
      configType: 'HA Tunnel Plus',
      note: 'JSON malformado',
      raw: json,
    };
  }

  return parseHatJson(data, fileName);
}

function parseHatJson(data, fileName) {
  const find = (...keys) => {
    for (const k of keys) {
      if (data[k] !== undefined && data[k] !== null && data[k] !== '') return data[k];
      const lk = Object.keys(data).find(x => x.toLowerCase() === k.toLowerCase());
      if (lk && data[lk]) return data[lk];
    }
    return '';
  };

  return {
    configName: find('configName', 'name') || fileName.replace(/\.hat$/i, ''),
    configType: 'HA Tunnel Plus',
    appName: 'HA Tunnel Plus',
    mode: find('connectionMode', 'mode', 'connectionType'),
    note: find('note', 'configNote', 'description'),

    host: find('proxyHost', 'host', 'sshHost'),
    port: find('proxyPort', 'port', 'sshPort'),

    ssh: {
      host: find('sshHost', 'ssh_host'),
      port: find('sshPort', 'ssh_port'),
      user: find('sshUsername', 'username', 'sshUser'),
      pass: find('sshPassword', 'password', 'sshPass'),
    },

    proxy: {
      host: find('proxyHost'),
      port: find('proxyPort'),
      type: find('proxyType') || 'HTTP',
      user: find('proxyUsername', 'proxyUser'),
      pass: find('proxyPassword', 'proxyPass'),
    },

    payload: find('customPayload', 'payload', 'rawPayload', 'requestPayload'),
    payloadMethod: find('payloadMethod', 'method') || 'CONNECT',

    sni: find('sni', 'sniHost', 'tlsSni'),
    tlsVersion: find('tlsVersion'),

    udpgw: find('udpgw'),
    dns: [find('dns', 'dnsServer')].filter(Boolean),

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
