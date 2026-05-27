/**
 * Gerenciador de prefixos (cache + DB)
 * Suporta vários prefixos separados por espaço ou vírgula
 */
const BotConfig = require('../database/models/BotConfig');
const config = require('../config');

let cachedPrefixes = null;
let cacheTime = 0;
const CACHE_TTL = 30000; // 30 segundos

async function getPrefixes() {
  const now = Date.now();
  if (cachedPrefixes && (now - cacheTime) < CACHE_TTL) {
    return cachedPrefixes;
  }
  try {
    const stored = await BotConfig.get('prefixes', null);
    let prefixes;
    if (stored && Array.isArray(stored) && stored.length) {
      prefixes = stored;
    } else if (typeof stored === 'string' && stored.trim()) {
      prefixes = stored.split(/[\s,]+/).filter(Boolean);
    } else {
      prefixes = [config.bot.prefix || '!'];
    }
    cachedPrefixes = prefixes;
    cacheTime = now;
    return prefixes;
  } catch (e) {
    return [config.bot.prefix || '!'];
  }
}

async function setPrefixes(prefixes) {
  let arr;
  if (Array.isArray(prefixes)) arr = prefixes;
  else if (typeof prefixes === 'string') arr = prefixes.split(/[\s,]+/).filter(Boolean);
  else arr = [config.bot.prefix || '!'];
  if (!arr.length) arr = ['!'];
  await BotConfig.set('prefixes', arr);
  cachedPrefixes = arr;
  cacheTime = Date.now();
  return arr;
}

/**
 * Detecta qual prefixo foi usado e retorna { prefix, text }
 * Se nenhum prefixo combina, retorna null
 */
async function detectPrefix(text) {
  if (!text) return null;
  const prefixes = await getPrefixes();
  for (const p of prefixes) {
    if (text.startsWith(p)) {
      return { prefix: p, rest: text.slice(p.length).trim() };
    }
  }
  return null;
}

async function getPrimaryPrefix() {
  const list = await getPrefixes();
  return list[0] || '!';
}

function clearCache() {
  cachedPrefixes = null;
  cacheTime = 0;
}

module.exports = { getPrefixes, setPrefixes, detectPrefix, getPrimaryPrefix, clearCache };
