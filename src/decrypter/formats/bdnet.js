/**
 * BD Net VPN (bdnet://)
 *
 * Estrutura observada:
 * - URI scheme: bdnet://
 * - Conteúdo: hex string (cada 2 chars = 1 byte)
 * - Header de 40 bytes comum (compartilhado com APNA Lite e outros derivados)
 * - Resto: dados criptografados com chave proprietária do app
 */
const crypto = require('crypto');
const zlib = require('zlib');
const { utilExtractStrings } = require('./_util');

// Keys conhecidas em apps derivados do mesmo SDK
const KNOWN_XOR_KEYS = [
  Buffer.from('BDNetVPN2024'),
  Buffer.from('bdnetvpn'),
  Buffer.from('BDNetSecretKey'),
  Buffer.from('NetEliteVPN'),
  Buffer.from('VpnTunnel2024'),
  Buffer.from('YOURUNIQUEKEY'),
  Buffer.from([0x4f, 0x07, 0x36, 0x16, 0x31, 0x06, 0x06, 0x5a]), // Header signature
  Buffer.from([0x42, 0x44, 0x4e, 0x45, 0x54]), // "BDNET"
];

const KNOWN_AES_KEYS = [
  'BDNetVPN2024SecretKey1234567890!',
  'bdnetvpnencryptionkey2024@#$%',
  'NetEliteVPNSecretKey1234567890',
  'NPVTunnel2021KeySecret',
  'YourCustomVPNKey2024',
];

function hexToBuffer(s) {
  // Remove o scheme bdnet://
  let h = s.replace(/^bdnet:\/\//i, '').trim();
  // Remove espaços e quebras de linha
  h = h.replace(/\s+/g, '');
  if (!/^[0-9a-f]+$/i.test(h)) {
    throw new Error('Conteúdo BD Net inválido (não é hex)');
  }
  if (h.length % 2 !== 0) h = h.slice(0, h.length - 1);
  return Buffer.from(h, 'hex');
}

function tryXor(buffer, key) {
  const out = Buffer.alloc(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    out[i] = buffer[i] ^ key[i % key.length];
  }
  return out;
}

function tryAes(encrypted, password, iv = Buffer.alloc(16, 0)) {
  try {
    const key = crypto.createHash('sha256').update(password).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(true);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch (e) { return null; }
}

function ratio(buffer) {
  if (!buffer || buffer.length === 0) return 0;
  let printable = 0;
  for (const b of buffer) if (b >= 32 && b <= 126) printable++;
  return printable / buffer.length;
}

async function parse(input, fileName) {
  // Aceita Buffer (arquivo) ou string (texto direto)
  let raw;
  if (Buffer.isBuffer(input)) {
    const s = input.toString('utf-8').trim();
    raw = s.startsWith('bdnet://') ? hexToBuffer(s) : input;
  } else {
    raw = hexToBuffer(String(input));
  }

  // ESTRUTURA: 40 bytes de header + dados
  const header = raw.slice(0, 40);
  const headerHex = header.toString('hex');
  const body = raw.slice(40);

  // Tenta decryptar
  let decrypted = null;
  let usedKey = null;

  // 1) Tenta XOR com keys conhecidas
  for (const key of KNOWN_XOR_KEYS) {
    const dec = tryXor(body, key);
    if (ratio(dec) > 0.7) { decrypted = dec; usedKey = `XOR:${key.toString('utf-8').replace(/[^\x20-\x7E]/g, '?')}`; break; }
  }

  // 2) Tenta AES com keys conhecidas
  if (!decrypted) {
    for (const pwd of KNOWN_AES_KEYS) {
      const dec = tryAes(body, pwd);
      if (dec && ratio(dec) > 0.6) { decrypted = dec; usedKey = `AES:${pwd}`; break; }
    }
    // Tenta com IV do header
    if (!decrypted) {
      for (const pwd of KNOWN_AES_KEYS) {
        const dec = tryAes(body, pwd, header.slice(0, 16));
        if (dec && ratio(dec) > 0.6) { decrypted = dec; usedKey = `AES+IV:${pwd}`; break; }
      }
    }
  }

  // 3) Tenta gzip
  if (!decrypted) {
    try { decrypted = zlib.gunzipSync(body); } catch (e) {}
  }

  // Extração de informações úteis
  const allStrings = utilExtractStrings(raw, 4);
  const interesting = allStrings.filter(s =>
    /\.com|\.net|\.org|\.io|\.xyz|ssh|proxy|host|port|user|pass|sni|payload|http/i.test(s)
  );

  // Se decryptamos algo, processa
  let extractedData = {};
  if (decrypted) {
    const decStr = decrypted.toString('utf-8');
    // Tenta JSON
    const jsonMatch = decStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { extractedData = JSON.parse(jsonMatch[0]); } catch (e) {}
    }
    // Procura padrões
    const hostMatch = decStr.match(/(?:host|server|proxy)[\s:=]+([a-zA-Z0-9.-]+\.[a-z]{2,})/i);
    const portMatch = decStr.match(/(?:port)[\s:=]+(\d{1,5})/i);
    const userMatch = decStr.match(/(?:user|username|login)[\s:=]+([a-zA-Z0-9._-]+)/i);
    const passMatch = decStr.match(/(?:pass|password|pwd)[\s:=]+([^\s,;}]+)/i);
    const sniMatch = decStr.match(/(?:sni|tls)[\s:=]+([a-zA-Z0-9.-]+\.[a-z]{2,})/i);

    if (hostMatch) extractedData.host = hostMatch[1];
    if (portMatch) extractedData.port = portMatch[1];
    if (userMatch) extractedData.user = userMatch[1];
    if (passMatch) extractedData.pass = passMatch[1];
    if (sniMatch) extractedData.sni = sniMatch[1];
  }

  const result = {
    configName: fileName?.replace(/\.(bdnet|txt)$/i, '') || 'BD Net Config',
    configType: 'BD Net VPN',
    appName: 'BD Net VPN',
    mode: 'SSH/Tunnel',

    host: extractedData.host || extractedData.proxy_host || '',
    port: extractedData.port || extractedData.proxy_port || '',
    ssh: {
      host: extractedData.ssh_host || extractedData.host || '',
      port: extractedData.ssh_port || '443',
      user: extractedData.ssh_user || extractedData.user || '',
      pass: extractedData.ssh_pass || extractedData.pass || '',
    },
    proxy: extractedData.proxy_host ? {
      host: extractedData.proxy_host,
      port: extractedData.proxy_port || '8080',
      type: 'HTTP',
    } : null,
    sni: extractedData.sni || '',
    payload: extractedData.payload || extractedData.custom_payload || '',

    note: decrypted
      ? `✅ Decryptado parcialmente com ${usedKey}`
      : `⚠️ Decryptação completa requer chave proprietária do BD Net VPN.\n` +
        `Foram extraídas ${interesting.length} strings interessantes do conteúdo binário.`,

    raw: {
      totalBytes: raw.length,
      headerHex: headerHex,
      headerSignature: '0x4f0736163106065a... (assinatura comum: BD Net / APNA Lite / similares)',
      interestingStrings: interesting,
      allStrings: allStrings.slice(0, 30),
      decryptionAttempt: usedKey || 'nenhuma key conhecida funcionou',
    },
    allFields: extractedData,
  };

  return result;
}

module.exports = { parse };
