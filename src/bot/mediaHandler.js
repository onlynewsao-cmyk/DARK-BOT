const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const https = require('https');
const http = require('http');

async function downloadFromMessage(msg) {
  return downloadMediaMessage(msg, 'buffer', {});
}

function fetchBuffer(url, timeout = 60000, redirects = 5) {
  return new Promise((resolve, reject) => {
    if (!url || typeof url !== 'string') return reject(new Error('URL inválida'));
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirects <= 0) return reject(new Error('Too many redirects'));
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return fetchBuffer(next, timeout, redirects - 1).then(resolve, reject);
      }
      if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout após ' + timeout + 'ms')); });
  });
}

async function fetchJson(url, timeout = 30000) {
  const buf = await fetchBuffer(url, timeout);
  const txt = buf.toString('utf-8');
  try { return JSON.parse(txt); }
  catch (e) { throw new Error('JSON inválido: ' + txt.slice(0, 100)); }
}

module.exports = { downloadFromMessage, fetchBuffer, fetchJson };
