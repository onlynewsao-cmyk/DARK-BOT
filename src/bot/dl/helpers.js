const ytdl = require('@distube/ytdl-core');
const yts = require('yt-search');
const mediaHandler = require('../mediaHandler');

const PRINCE = 'https://api.princetechn.com/api/download';

function extractYtId(url) {
  if (!url) return '';
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  return '';
}

async function searchYoutube(query) {
  if (/^https?:\/\//.test(query) || extractYtId(query)) {
    return query.startsWith('http') ? query : 'https://www.youtube.com/watch?v=' + extractYtId(query);
  }
  try {
    const r = await yts(query);
    const v = r.videos && r.videos[0];
    if (v && v.url) { console.log('[YT-SEARCH] ' + query + ' -> ' + v.title); return v.url; }
  } catch (e) {}
  throw new Error('Video nao encontrado: ' + query);
}

async function searchYoutubeFull(query) {
  if (/^https?:\/\//.test(query) || extractYtId(query)) return null;
  try { const r = await yts(query); return (r.videos && r.videos[0]) || null; }
  catch (e) { return null; }
}

async function tryApis(apis, parser, label) {
  label = label || 'API';
  const errors = [];
  for (let i = 0; i < apis.length; i++) {
    try {
      const r = await mediaHandler.fetchJson(apis[i], 25000);
      const result = parser(r);
      if (result && result.url) {
        console.log('[' + label + '] OK API ' + (i + 1));
        return result;
      }
      errors.push('API' + (i + 1) + ':noUrl');
    } catch (e) { errors.push('API' + (i + 1) + ':' + e.message.slice(0, 40)); }
  }
  throw new Error(errors.slice(0, 4).join(' | '));
}

async function streamToBuffer(stream, maxSize) {
  maxSize = maxSize || 30 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    const chunks = []; let total = 0;
    stream.on('data', c => { chunks.push(c); total += c.length; if (total > maxSize) { stream.destroy(); reject(new Error('Arquivo > 30MB')); } });
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    setTimeout(() => { stream.destroy(); reject(new Error('timeout')); }, 120000);
  });
}

module.exports = { PRINCE, ytdl, yts, mediaHandler, extractYtId, searchYoutube, searchYoutubeFull, tryApis, streamToBuffer };
