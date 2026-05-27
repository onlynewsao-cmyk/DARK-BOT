/**
 * Downloader usando APIs públicas gratuitas
 * (Ideal para Render Free — sem ffmpeg/yt-dlp)
 */
const mediaHandler = require('./mediaHandler');

async function tryApis(apis, parser) {
  let lastErr;
  for (const url of apis) {
    try {
      const r = await mediaHandler.fetchJson(url);
      const result = parser(r);
      if (result) return result;
    } catch (e) { lastErr = e; }
  }
  throw new Error(lastErr?.message || 'Todas as APIs falharam');
}

// ==================== YOUTUBE ====================
async function youtubeAudio(query) {
  const isUrl = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/i.test(query);
  let url = query;
  if (!isUrl) {
    try {
      const s = await mediaHandler.fetchJson(`https://api.popcat.xyz/youtube?q=${encodeURIComponent(query)}`);
      url = s?.url || query;
    } catch (e) {}
  }
  return tryApis([
    `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`,
    `https://api.akuari.my.id/downloader/youtubeaudio?link=${encodeURIComponent(url)}`,
    `https://itzpire.com/download/youtube-audio?url=${encodeURIComponent(url)}`,
    `https://api.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(url)}`,
  ], (r) => {
    const dl = r?.data?.dl || r?.url || r?.result?.url || r?.audio;
    const title = r?.data?.title || r?.title || r?.result?.title || query;
    if (dl) return { title, url: dl };
    return null;
  });
}

async function youtubeVideo(query) {
  const isUrl = /^https?:\/\//.test(query);
  let url = query;
  if (!isUrl) {
    try {
      const s = await mediaHandler.fetchJson(`https://api.popcat.xyz/youtube?q=${encodeURIComponent(query)}`);
      url = s?.url || query;
    } catch (e) {}
  }
  return tryApis([
    `https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(url)}`,
    `https://api.akuari.my.id/downloader/youtubevideo?link=${encodeURIComponent(url)}`,
    `https://api.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(url)}`,
  ], (r) => {
    const dl = r?.data?.dl || r?.url || r?.result?.url || r?.video;
    const title = r?.data?.title || r?.title || r?.result?.title || query;
    if (dl) return { title, url: dl };
    return null;
  });
}

// ==================== TIKTOK ====================
async function tiktok(url) {
  return tryApis([
    `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
    `https://api.siputzx.my.id/api/tiktok?url=${encodeURIComponent(url)}`,
    `https://api.davidcyriltech.my.id/download/tiktok?url=${encodeURIComponent(url)}`,
  ], (r) => {
    const dl = r?.data?.play || r?.data?.[0]?.url || r?.result?.video?.no_watermark || r?.video;
    const title = r?.data?.title || r?.title || 'TikTok';
    if (dl) return { title, url: dl };
    return null;
  });
}

// ==================== INSTAGRAM ====================
async function instagram(url) {
  const r = await tryApis([
    `https://api.siputzx.my.id/api/d/igdl?url=${encodeURIComponent(url)}`,
    `https://api.davidcyriltech.my.id/download/instagram?url=${encodeURIComponent(url)}`,
  ], (r) => {
    const item = r?.data?.[0] || r?.result?.[0] || (r?.url ? { url: r.url } : null);
    if (item?.url) return { url: item.url };
    return null;
  });
  return { type: r.url.includes('.mp4') ? 'video' : 'image', url: r.url };
}

// ==================== FACEBOOK ====================
async function facebook(url) {
  return tryApis([
    `https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(url)}`,
    `https://api.davidcyriltech.my.id/download/facebook?url=${encodeURIComponent(url)}`,
  ], (r) => {
    const dl = r?.data?.[0]?.url || r?.result?.url || r?.url;
    if (dl) return { url: dl };
    return null;
  });
}

// ==================== TWITTER / X ====================
async function twitter(url) {
  return tryApis([
    `https://api.siputzx.my.id/api/d/twitter?url=${encodeURIComponent(url)}`,
    `https://api.davidcyriltech.my.id/download/twitter?url=${encodeURIComponent(url)}`,
  ], (r) => {
    const dl = r?.data?.[0]?.url || r?.result?.url || r?.url;
    if (dl) return { url: dl };
    return null;
  });
}

// ==================== SPOTIFY ====================
async function spotify(url) {
  return tryApis([
    `https://api.siputzx.my.id/api/d/spotify?url=${encodeURIComponent(url)}`,
    `https://api.davidcyriltech.my.id/download/spotifydl?url=${encodeURIComponent(url)}`,
  ], (r) => {
    const dl = r?.data?.url || r?.result?.url || r?.url;
    const title = r?.data?.title || r?.result?.title || 'Spotify';
    if (dl) return { title, url: dl };
    return null;
  });
}

// ==================== SOUNDCLOUD ====================
async function soundcloud(url) {
  return tryApis([
    `https://api.siputzx.my.id/api/d/soundcloud?url=${encodeURIComponent(url)}`,
    `https://api.davidcyriltech.my.id/download/soundcloud?url=${encodeURIComponent(url)}`,
  ], (r) => {
    const dl = r?.data?.url || r?.result?.url || r?.url;
    const title = r?.data?.title || r?.result?.title || 'SoundCloud';
    if (dl) return { title, url: dl };
    return null;
  });
}

// ==================== PINTEREST ====================
async function pinterest(url) {
  return tryApis([
    `https://api.siputzx.my.id/api/d/pinterest?url=${encodeURIComponent(url)}`,
  ], (r) => {
    const dl = r?.data?.url || r?.result?.url || r?.url;
    if (dl) return { url: dl };
    return null;
  });
}

// ==================== IMAGE SEARCH ====================
async function pinterestSearch(query) {
  return tryApis([
    `https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(query)}`,
  ], (r) => {
    const arr = r?.data || r?.result;
    if (Array.isArray(arr) && arr.length) {
      const pick = arr[Math.floor(Math.random() * Math.min(arr.length, 10))];
      return { url: pick.image || pick.url || pick };
    }
    return null;
  });
}

module.exports = {
  youtubeAudio, youtubeVideo, tiktok, instagram, facebook,
  twitter, spotify, soundcloud, pinterest, pinterestSearch,
};
