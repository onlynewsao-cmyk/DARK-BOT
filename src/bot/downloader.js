/**
 * Downloader v4 — APIs testadas e funcionando (Nov 2026)
 * Estratégia: ytdl-core local + APIs externas atualizadas + fallback agressivo
 */
const ytdl = require('@distube/ytdl-core');
const yts = require('yt-search');
const mediaHandler = require('./mediaHandler');

// ==================== HELPERS ====================
function extractYtId(url) {
  if (!url) return '';
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  return '';
}

async function searchYoutube(query) {
  if (/^https?:\/\//.test(query) || extractYtId(query)) {
    return query.startsWith('http') ? query : `https://www.youtube.com/watch?v=${extractYtId(query)}`;
  }
  try {
    const r = await yts(query);
    const v = r.videos?.[0];
    if (v?.url) {
      console.log(`[YT-SEARCH] "${query}" → ${v.title}`);
      return v.url;
    }
  } catch (e) { console.warn('yt-search:', e.message); }
  throw new Error('Não encontrei vídeo: ' + query);
}

async function searchYoutubeFull(query) {
  if (/^https?:\/\//.test(query) || extractYtId(query)) return null;
  try {
    const r = await yts(query);
    return r.videos?.[0] || null;
  } catch (e) { return null; }
}

async function tryApis(apis, parser, label = 'API') {
  const errors = [];
  for (let i = 0; i < apis.length; i++) {
    const url = apis[i];
    try {
      const r = await mediaHandler.fetchJson(url, 25000);
      const result = parser(r);
      if (result && result.url) {
        console.log(`[${label}] ✅ API ${i+1} → ${result.url.slice(0,60)}...`);
        return result;
      }
      errors.push(`API ${i+1}: sem URL no retorno`);
    } catch (e) {
      errors.push(`API ${i+1}: ${e.message.slice(0,60)}`);
    }
  }
  throw new Error(errors.slice(0, 5).join(' | '));
}

async function streamToBuffer(stream, maxSize = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    stream.on('data', c => {
      chunks.push(c);
      total += c.length;
      if (total > maxSize) { stream.destroy(); reject(new Error('Arquivo > 30MB')); }
    });
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    setTimeout(() => { stream.destroy(); reject(new Error('timeout no stream')); }, 120000);
  });
}

// ==================== YOUTUBE AUDIO ====================
async function youtubeAudio(query) {
  const url = await searchYoutube(query);
  const info = await searchYoutubeFull(query);
  const fallbackTitle = info?.title || 'YouTube Audio';

  // 🥇 PrinceTech API (testada, funcionando em 2026)
  const apis = [
    `https://api.princetechn.com/api/download/dlmp3?apikey=prince&url=${encodeURIComponent(url)}`,
    `https://api.princetechn.com/api/download/ytmp3?apikey=prince&url=${encodeURIComponent(url)}`,
    `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`,
    `https://api.dreaded.site/api/ytdl/audio?url=${encodeURIComponent(url)}`,
    `https://itzpire.com/download/youtube-audio?url=${encodeURIComponent(url)}`,
    `https://api.giftedtech.web.id/api/download/dlmp3?apikey=gifted&url=${encodeURIComponent(url)}`,
  ];

  try {
    return await tryApis(apis, (r) => {
      // Múltiplos formatos de resposta
      const u = r?.result?.download_url || r?.result?.url || r?.result?.dl_link ||
                r?.data?.dl || r?.data?.url || r?.data?.audio || r?.data?.download_url ||
                r?.url || r?.audio || r?.dl_link || r?.downloadUrl;
      const t = r?.result?.title || r?.data?.title || r?.title || fallbackTitle;
      if (u) return { title: t, url: u };
      return null;
    }, 'YT-AUDIO');
  } catch (apiErr) {
    // 🥈 Fallback: ytdl-core local
    console.warn('[YT-AUDIO] Todas APIs falharam, tentando ytdl-core...');
    try {
      const videoInfo = await ytdl.getInfo(url);
      const audioFormats = ytdl.filterFormats(videoInfo.formats, 'audioonly');
      const best = audioFormats.find(f => f.audioBitrate >= 128) || audioFormats[0];
      if (best?.url) {
        console.log(`[YT-AUDIO] ✅ ytdl-core: ${best.audioBitrate}kbps`);
        return {
          title: videoInfo.videoDetails.title || fallbackTitle,
          url: best.url,
        };
      }
    } catch (ytdlErr) {
      console.warn('[YT-AUDIO] ytdl-core também falhou:', ytdlErr.message);
    }
    throw new Error(apiErr.message);
  }
}

/**
 * Baixa áudio direto como buffer (último recurso quando URL externa está com restrição)
 */
async function youtubeAudioBuffer(query) {
  const url = await searchYoutube(query);
  try {
    const stream = ytdl(url, {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25,
    });
    const buffer = await streamToBuffer(stream);
    const info = await ytdl.getBasicInfo(url).catch(() => null);
    return {
      title: info?.videoDetails?.title || 'YouTube Audio',
      buffer,
    };
  } catch (e) {
    throw new Error('Stream falhou: ' + e.message);
  }
}

// ==================== YOUTUBE VIDEO ====================
async function youtubeVideo(query) {
  const url = await searchYoutube(query);
  const info = await searchYoutubeFull(query);
  const fallbackTitle = info?.title || 'YouTube Video';

  const apis = [
    `https://api.princetechn.com/api/download/dlmp4?apikey=prince&url=${encodeURIComponent(url)}`,
    `https://api.princetechn.com/api/download/ytmp4?apikey=prince&url=${encodeURIComponent(url)}`,
    `https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(url)}`,
    `https://api.dreaded.site/api/ytdl/video?url=${encodeURIComponent(url)}`,
    `https://itzpire.com/download/youtube-video?url=${encodeURIComponent(url)}`,
    `https://api.giftedtech.web.id/api/download/dlmp4?apikey=gifted&url=${encodeURIComponent(url)}`,
  ];

  try {
    return await tryApis(apis, (r) => {
      const u = r?.result?.download_url || r?.result?.url || r?.result?.video ||
                r?.data?.dl || r?.data?.url || r?.data?.video || r?.data?.download_url ||
                r?.url || r?.video || r?.downloadUrl;
      const t = r?.result?.title || r?.data?.title || r?.title || fallbackTitle;
      if (u) return { title: t, url: u };
      return null;
    }, 'YT-VIDEO');
  } catch (apiErr) {
    // Fallback: ytdl-core
    try {
      const videoInfo = await ytdl.getInfo(url);
      const formats = ytdl.filterFormats(videoInfo.formats, 'audioandvideo')
        .filter(f => f.container === 'mp4')
        .sort((a,b) => (parseInt(b.qualityLabel) || 0) - (parseInt(a.qualityLabel) || 0));
      const best = formats.find(f => parseInt(f.qualityLabel) <= 480) || formats[0];
      if (best?.url) {
        return {
          title: videoInfo.videoDetails.title || fallbackTitle,
          url: best.url,
          quality: best.qualityLabel,
        };
      }
    } catch (e) {}
    throw new Error(apiErr.message);
  }
}

// ==================== TIKTOK ====================
async function tiktok(url) {
  const apis = [
    `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
    `https://api.princetechn.com/api/download/tiktokdl?apikey=prince&url=${encodeURIComponent(url)}`,
    `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`,
    `https://api.siputzx.my.id/api/tiktok?url=${encodeURIComponent(url)}`,
    `https://itzpire.com/download/tiktok?url=${encodeURIComponent(url)}`,
    `https://api.giftedtech.web.id/api/download/tiktokdl?apikey=gifted&url=${encodeURIComponent(url)}`,
  ];
  return tryApis(apis, (r) => {
    const u = r?.data?.play || r?.data?.[0]?.url ||
              r?.result?.video?.no_watermark || r?.result?.no_watermark || r?.result?.video ||
              r?.video?.noWatermark || r?.video?.no_watermark || r?.video ||
              r?.url || r?.data?.url || r?.result?.url ||
              r?.data?.video?.noWatermark || r?.data?.noWatermark;
    const t = r?.data?.title || r?.title || r?.result?.title || 'TikTok';
    if (u) return { title: t, url: typeof u === 'string' ? u : u?.url };
    return null;
  }, 'TIKTOK');
}

// ==================== INSTAGRAM ====================
async function instagram(url) {
  const apis = [
    `https://api.princetechn.com/api/download/igdl?apikey=prince&url=${encodeURIComponent(url)}`,
    `https://api.siputzx.my.id/api/d/igdl?url=${encodeURIComponent(url)}`,
    `https://itzpire.com/download/instagram?url=${encodeURIComponent(url)}`,
    `https://api.giftedtech.web.id/api/download/igdl?apikey=gifted&url=${encodeURIComponent(url)}`,
  ];
  const r = await tryApis(apis, (r) => {
    const item = r?.result?.[0] || r?.data?.[0] || r?.result || r?.data || r;
    const u = item?.url || item?.download_url || item?.video || item?.image;
    if (u) return { url: typeof u === 'string' ? u : u.url };
    return null;
  }, 'IG');
  return { type: r.url.includes('.mp4') ? 'video' : 'image', url: r.url };
}

// ==================== FACEBOOK ====================
async function facebook(url) {
  const apis = [
    `https://api.princetechn.com/api/download/facebook?apikey=prince&url=${encodeURIComponent(url)}`,
    `https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(url)}`,
    `https://itzpire.com/download/facebook?url=${encodeURIComponent(url)}`,
    `https://api.giftedtech.web.id/api/download/facebook?apikey=gifted&url=${encodeURIComponent(url)}`,
  ];
  return tryApis(apis, (r) => {
    const u = r?.result?.hd || r?.result?.sd || r?.result?.url || r?.result?.download_url ||
              r?.data?.[0]?.url || r?.data?.hd || r?.data?.sd || r?.data?.url ||
              r?.url || r?.hd || r?.sd;
    if (u) return { url: u };
    return null;
  }, 'FB');
}

// ==================== TWITTER ====================
async function twitter(url) {
  const apis = [
    `https://api.princetechn.com/api/download/twitterdl?apikey=prince&url=${encodeURIComponent(url)}`,
    `https://api.siputzx.my.id/api/d/twitter?url=${encodeURIComponent(url)}`,
    `https://itzpire.com/download/twitter?url=${encodeURIComponent(url)}`,
    `https://api.giftedtech.web.id/api/download/twitter?apikey=gifted&url=${encodeURIComponent(url)}`,
  ];
  return tryApis(apis, (r) => {
    const u = r?.result?.url || r?.result?.hd || r?.result?.download_url ||
              r?.data?.[0]?.url || r?.data?.url || r?.url || r?.video;
    if (u) return { url: u };
    return null;
  }, 'TWITTER');
}

// ==================== SPOTIFY ====================
async function spotify(url) {
  const apis = [
    `https://api.princetechn.com/api/download/spotifydl?apikey=prince&url=${encodeURIComponent(url)}`,
    `https://api.siputzx.my.id/api/d/spotify?url=${encodeURIComponent(url)}`,
    `https://api.giftedtech.web.id/api/download/spotifydl?apikey=gifted&url=${encodeURIComponent(url)}`,
  ];
  return tryApis(apis, (r) => {
    const u = r?.result?.download_url || r?.result?.url || r?.data?.url || r?.url || r?.data?.download;
    const t = r?.result?.title || r?.data?.title || r?.title || 'Spotify';
    if (u) return { title: t, url: u };
    return null;
  }, 'SPOTIFY');
}

// ==================== SOUNDCLOUD ====================
async function soundcloud(url) {
  const apis = [
    `https://api.princetechn.com/api/download/soundcloud?apikey=prince&url=${encodeURIComponent(url)}`,
    `https://api.siputzx.my.id/api/d/soundcloud?url=${encodeURIComponent(url)}`,
    `https://api.giftedtech.web.id/api/download/soundcloud?apikey=gifted&url=${encodeURIComponent(url)}`,
  ];
  return tryApis(apis, (r) => {
    const u = r?.result?.url || r?.result?.download_url || r?.data?.url || r?.url;
    const t = r?.result?.title || r?.data?.title || r?.title || 'SoundCloud';
    if (u) return { title: t, url: u };
    return null;
  }, 'SC');
}

// ==================== PINTEREST ====================
async function pinterest(url) {
  const apis = [
    `https://api.princetechn.com/api/download/pinterestdl?apikey=prince&url=${encodeURIComponent(url)}`,
    `https://api.siputzx.my.id/api/d/pinterest?url=${encodeURIComponent(url)}`,
  ];
  return tryApis(apis, (r) => {
    const u = r?.result?.url || r?.result?.download_url || r?.data?.url || r?.url;
    if (u) return { url: u };
    return null;
  }, 'PINTEREST');
}

async function pinterestSearch(query) {
  const apis = [
    `https://api.princetechn.com/api/search/pinterest?apikey=prince&query=${encodeURIComponent(query)}`,
    `https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(query)}`,
  ];
  return tryApis(apis, (r) => {
    const arr = r?.result || r?.data;
    if (Array.isArray(arr) && arr.length) {
      const pick = arr[Math.floor(Math.random() * Math.min(arr.length, 10))];
      const u = pick?.image || pick?.url || pick?.src || pick;
      if (u) return { url: typeof u === 'string' ? u : u.url };
    }
    return null;
  }, 'PIN-SEARCH');
}

module.exports = {
  youtubeAudio, youtubeVideo, youtubeAudioBuffer,
  tiktok, instagram, facebook, twitter, spotify, soundcloud,
  pinterest, pinterestSearch, searchYoutube, searchYoutubeFull,
};
