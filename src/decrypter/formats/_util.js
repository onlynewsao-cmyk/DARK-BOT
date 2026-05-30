/**
 * Utilitários compartilhados entre parsers
 */
function utilExtractStrings(buffer, minLen = 6) {
  const result = [];
  let cur = '';
  for (const b of buffer) {
    if (b >= 32 && b <= 126) cur += String.fromCharCode(b);
    else { if (cur.length >= minLen) result.push(cur); cur = ''; }
  }
  if (cur.length >= minLen) result.push(cur);
  return result.slice(0, 200);
}

function findInJson(data) {
  return (...keys) => {
    if (!data || typeof data !== 'object') return '';
    for (const k of keys) {
      // Direto
      if (data[k] !== undefined && data[k] !== null && data[k] !== '') return data[k];
      // Case insensitive
      const lk = Object.keys(data).find(x => x.toLowerCase() === k.toLowerCase());
      if (lk && data[lk] !== '' && data[lk] !== null) return data[lk];
      // Busca recursiva (1 nível)
      for (const objKey of Object.keys(data)) {
        if (data[objKey] && typeof data[objKey] === 'object' && !Array.isArray(data[objKey])) {
          if (data[objKey][k] !== undefined && data[objKey][k] !== '') return data[objKey][k];
          const lk2 = Object.keys(data[objKey]).find(x => x.toLowerCase() === k.toLowerCase());
          if (lk2 && data[objKey][lk2] !== '' && data[objKey][lk2] !== null) return data[objKey][lk2];
        }
      }
    }
    return '';
  };
}

function tryXor(buffer, key) {
  try {
    const out = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length; i++) out[i] = buffer[i] ^ key[i % key.length];
    return out.toString('utf-8');
  } catch (e) { return null; }
}

module.exports = { utilExtractStrings, findInJson, tryXor };
