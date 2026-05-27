const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const https = require('https');
const http = require('http');

async function downloadFromMessage(msg) {
  return downloadMediaMessage(msg, 'buffer', {});
}

function fetchBuffer(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (DARK-BOT)' },
      timeout: 60000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirects <= 0) return reject(new Error('Too many redirects'));
        const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        return fetchBuffer(next, redirects - 1).then(resolve, reject);
      }
      if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchJson(url) {
  const buf = await fetchBuffer(url);
  try { return JSON.parse(buf.toString('utf-8')); }
  catch (e) { throw new Error('JSON inválido'); }
}

module.exports = { downloadFromMessage, fetchBuffer, fetchJson };
