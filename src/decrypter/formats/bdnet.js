/**
 * BD Net VPN (bdnet://) v2 — DECRYPT FUNCIONAL!
 *
 * Algoritmo descoberto:
 * - Conteúdo é HEX
 * - Criptografia: XOR com chave variável de até 24 bytes
 * - Início da chave conhecido: "4%PdXch>fkP]4%PdXcm/?gtE"
 * - Algoritmo de auto-recovery: assume plain começa com '{"friendly_name":"' (JSON)
 */
const { utilExtractStrings } = require('./_util');

// Chaves descobertas (extrair plain conhecido do header XOR)
const KNOWN_KEYS = [
  // Chave de 24 bytes recuperada do plain '{"friendly_name":"BD-NETFLIX-LIFETIME-2026"...'
  Buffer.from('342550645863683e666b505d3425506458636d2f3f677445', 'hex'),
  // Chave de 12 bytes (primeiros 12 da de 24)
  Buffer.from('342550645863683e666b505d', 'hex'),
  // Variações descobertas
  Buffer.from('342550645861', 'hex'),       // "4%Pdxa"
  Buffer.from('342550645863', 'hex'),       // "4%PdXc"
  Buffer.from('4%PdXch>fkP]'),               // ASCII direto
];

// Plain texts conhecidos do início de JSON BD Net (para auto-recovery)
const KNOWN_PLAINS = [
  '{"friendly_name":"',
  '{"name":"',
  '{"config_name":"',
  '{"data":"',
  '{"type":"',
];

function hexToBuffer(s) {
  let h = String(s).replace(/^bdnet:\/\//i, '').trim().replace(/\s+/g, '');
  if (!/^[0-9a-fA-F]+$/.test(h)) {
    throw new Error('Conteúdo BD Net inválido (não é hex)');
  }
  if (h.length % 2 !== 0) h = h.slice(0, h.length - 1);
  return Buffer.from(h, 'hex');
}

function xor(buffer, key) {
  const out = Buffer.alloc(buffer.length);
  for (let i = 0; i < buffer.length; i++) out[i] = buffer[i] ^ key[i % key.length];
  return out;
}

function ratio(buf) {
  if (!buf || buf.length === 0) return 0;
  let p = 0;
  for (const b of buf) if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) p++;
  return p / buf.length;
}

function jsonScore(text) {
  // Conta padrões de JSON
  let score = 0;
  if (text.includes('{"')) score += 10;
  if (text.includes('":"')) score += 10;
  if (text.includes('","')) score += 8;
  if (text.includes('":')) score += 5;
  if (text.includes('"}')) score += 5;
  // Penaliza não-imprimíveis
  for (const c of text) if (c.charCodeAt(0) > 126 || (c.charCodeAt(0) < 32 && c !== '\n' && c !== '\r' && c !== '\t')) score -= 0.1;
  return score;
}

/**
 * Auto-recovery: tenta descobrir a chave do XOR usando o plain conhecido
 */
function recoverKeyFromPlain(encBuf, plain, keyLen = 24) {
  if (plain.length < keyLen) return null;
  const key = Buffer.alloc(keyLen);
  for (let i = 0; i < keyLen; i++) {
    key[i] = encBuf[i] ^ plain.charCodeAt(i);
  }
  return key;
}

/**
 * Extrai campos de um JSON parcialmente corrompido (regex)
 */
function extractJsonFields(text) {
  const fields = {};
  // Padrão "campo":"valor" — captura valores até a próxima aspa
  const re = /"(\w[\w_]{0,30})"\s*:\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1].length > 0 && m[1].length < 40) {
      fields[m[1]] = m[2];
    }
  }
  return fields;
}

async function parse(input, fileName) {
  // Aceita Buffer ou string
  let raw;
  if (Buffer.isBuffer(input)) {
    const s = input.toString('utf-8').trim();
    raw = s.startsWith('bdnet://') ? hexToBuffer(s) : input;
  } else {
    raw = hexToBuffer(String(input));
  }

  let bestDecrypt = null;
  let bestScore = -Infinity;
  let usedKey = null;
  let usedMethod = 'none';

  // 1) Tenta chaves conhecidas
  for (const key of KNOWN_KEYS) {
    const dec = xor(raw, key);
    const decStr = dec.toString('utf-8');
    const score = jsonScore(decStr);
    if (score > bestScore && ratio(dec) > 0.5) {
      bestScore = score;
      bestDecrypt = dec;
      usedKey = key.toString('hex');
      usedMethod = `XOR-known-${key.length}b`;
    }
  }

  // 2) Auto-recovery com plain text conhecidos
  for (const plain of KNOWN_PLAINS) {
    for (const kl of [12, 16, 18, 20, 24, 32]) {
      const key = recoverKeyFromPlain(raw, plain, Math.min(kl, plain.length));
      if (!key) continue;
      const dec = xor(raw, key);
      const decStr = dec.toString('utf-8');
      const score = jsonScore(decStr);
      if (score > bestScore && ratio(dec) > 0.5) {
        bestScore = score;
        bestDecrypt = dec;
        usedKey = key.toString('hex');
        usedMethod = `XOR-recovered-${kl}b plain="${plain.slice(0,20)}"`;
      }
    }
  }

  // 3) Statistical recovery — assume JSON, tenta cada keyLen
  if (bestScore < 30) {
    for (const kl of [12, 18, 24]) {
      const key = Buffer.alloc(kl);
      for (let k = 0; k < kl; k++) {
        let best = 0, bestS = -Infinity;
        for (let cand = 0; cand < 256; cand++) {
          let s = 0;
          for (let i = k; i < raw.length; i += kl) {
            const d = raw[i] ^ cand;
            if (d === 0x22) s += 8;       // "
            else if (d === 0x3A) s += 5;  // :
            else if (d === 0x2C) s += 4;  // ,
            else if (d === 0x7B || d === 0x7D) s += 4; // { }
            else if (d === 0x20) s += 2;  // space
            else if (d >= 0x61 && d <= 0x7A) s += 2; // a-z
            else if (d >= 0x41 && d <= 0x5A) s += 1; // A-Z
            else if (d >= 0x30 && d <= 0x39) s += 1; // 0-9
            else if (d < 0x20 || d > 0x7E) s -= 3;
          }
          if (s > bestS) { bestS = s; best = cand; }
        }
        key[k] = best;
      }
      const dec = xor(raw, key);
      const score = jsonScore(dec.toString('utf-8'));
      if (score > bestScore) {
        bestScore = score;
        bestDecrypt = dec;
        usedKey = key.toString('hex');
        usedMethod = `XOR-statistical-${kl}b`;
      }
    }
  }

  // EXTRAÇÃO DE CAMPOS
  let extractedData = {};
  let decryptedText = '';
  if (bestDecrypt) {
    decryptedText = bestDecrypt.toString('utf-8');
    extractedData = extractJsonFields(decryptedText);

    // DECRYPT DO PAYLOAD INTERNO: o "payload" é HEX, e quando convertido,
    // é XOR'd com a mesma chave (mas com offset diferente)
    if (extractedData.payload && /^[0-9a-f]+$/i.test(extractedData.payload) && usedKey) {
      try {
        const payloadBuf = Buffer.from(extractedData.payload, 'hex');
        const keyBuf = Buffer.from(usedKey, 'hex');
        // Aplica XOR ciclico
        const decPayload = Buffer.alloc(payloadBuf.length);
        for (let i = 0; i < payloadBuf.length; i++) {
          decPayload[i] = payloadBuf[i] ^ keyBuf[i % keyBuf.length];
        }
        const payloadStr = decPayload.toString('utf-8');
        // Verifica se parece HTTP (GET, CONNECT, POST...)
        if (/HTTP\/[12]\.[01]|CONNECT|GET |POST |Host:|\[crlf\]|\[host\]/i.test(payloadStr)) {
          extractedData.payload_decrypted = payloadStr;
          extractedData.payload_hex_raw = extractedData.payload;
          extractedData.payload = payloadStr;  // Substitui pelo decryptado
        }
      } catch (e) { /* ignora se falhar */ }
    }
  }

  // Strings legíveis
  const allStrings = utilExtractStrings(raw, 5);

  const result = {
    configName: extractedData.friendly_name || extractedData.name || extractedData.config_name ||
                fileName?.replace(/\.(bdnet|txt)$/i, '') || 'BD Net Config',
    configType: 'BD Net VPN',
    appName: 'BD Net VPN',
    mode: extractedData.method || extractedData.mode || 'SSH/Tunnel',

    host: extractedData.host || extractedData.server || extractedData.proxy_host || '',
    port: extractedData.port || extractedData.proxy_port || '',

    ssh: {
      host: extractedData.ssh_host || extractedData.host || '',
      port: extractedData.ssh_port || '443',
      user: extractedData.ssh_user || extractedData.username || '',
      pass: extractedData.ssh_pass || extractedData.password || '',
    },

    proxy: extractedData.proxy_host || extractedData.host ? {
      host: extractedData.proxy_host || extractedData.host || '',
      port: extractedData.proxy_port || extractedData.port || '8080',
      type: extractedData.method?.toUpperCase() || 'HTTP',
    } : null,

    sni: extractedData.sni || extractedData.dothost || '',
    payload: extractedData.payload || extractedData.custom_payload || '',
    payloadMethod: extractedData.method || 'HTTP',

    note: bestScore > 50
      ? `✅ Decrypt OK (${usedMethod}, score=${bestScore.toFixed(0)})`
      : bestScore > 20
      ? `⚠️ Decrypt parcial (${usedMethod}, score=${bestScore.toFixed(0)})`
      : `❌ Decrypt falhou. Algoritmo BD Net pode ter mudado.`,

    raw: {
      totalBytes: raw.length,
      headerHex: raw.slice(0, 40).toString('hex'),
      decryptionMethod: usedMethod,
      decryptionScore: bestScore,
      keyUsed: usedKey,
      decryptedPreview: decryptedText.slice(0, 800).replace(/[^\x20-\x7E\n\r\t]/g, '·'),
      allFields: extractedData,
      knownStrings: allStrings.filter(s => /\.com|\.net|\.org|\.io|ssh|proxy|host|port|user|pass|sni|payload/i.test(s)),
    },
    allFields: extractedData,
  };

  return result;
}

module.exports = { parse };
