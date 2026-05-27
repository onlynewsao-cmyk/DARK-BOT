/**
 * Downloader v2 — múltiplas APIs com fallback agressivo
 */
const mediaHandler = require('./mediaHandler');

async function tryApis(apis, parser, label = 'API') {
  const errors = [];
  for (let i = 0; i < apis.length; i++) {
    const url = apis[i];
    try {
      console.log(`[${label}] tentando ${i+1}/${apis.length}: ${url.slice(0,80)}...`);
      const r = await mediaHandler.fetchJson(url, 30000);
      const result = parser(r);
      if (result && result.url) {
        console.log(`[${label}] ✅ sucesso na API ${i+1}`);
        return result;
      }
      errors.push(`API ${i+1}: sem URL`);
    } catch (e) {
      errors.push(`API ${i+1}: ${e.message}`);
    }
  }
  throw new Error(`Todas as ${apis.length} APIs falharam:\n${errors.join('\n').slice(0,300)}`);
}

function extractYtId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : '';
}

async function searchYoutube(query) {
  if (/^https?:\/\//.test(query)) return query;
  const apis = [
    `https://api.popcat.xyz/youtube?q=${encodeURIComponent(query)}`,
    `https://api.siputzx.my.id/api/s/youtube?query=${encodeURIComponent(query)}`,
    `https://itzpire.com/search/youtube?query=${encodeURIComponent(query)}`,
  ];
  for (const url of apis) {
    try {
      const r = await mediaHandler.fetchJson(url, 15000);
      const link = r?.url || r?.data?.[0]?.url || r?.result?.[0]?.url || r?.data?.url;
      if (link && link.includes('youtu')) return link;
    } catch (e) {}
  }
  // Fallback: tenta pegar primeiro vídeo via Invidious
  try {
    const r = await mediaHandler.fetchJson(`https://invidious.snopyta.org/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
    if (r?.[0]?.videoId) return `https://www.youtube.com/watch?v=${r[0].videoId}`;
  } catch (e) {}
  throw new Error('Não encontrei nenhum vídeo para: ' + query);
}

// ==================== YOUTUBE ====================
async function youtubeAudio(query) {
  const url = await searchYoutube(query);
  const id = extractYtId(url);

  const apis = [
    `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`,
    `https://api.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(url)}`,
    `https://api.akuari.my.id/downloader/youtubeaudio?link=${encodeURIComponent(url)}`,
    `https://api.dreaded.site/api/ytdl/audio?url=${encodeURIComponent(url)}`,
    `https://itzpire.com/download/youtube-audio?url=${encodeURIComponent(url)}`,
    `https://api.nyxs.pw/dl/yt-audio?url=${encodeURIComponent(url)}`,
    `https://api.tioo.eu.org/api/downloader/ytmp3?url=${encodeURIComponent(url)}`,
    // APIs sem auth/cookies
    id ? `https://co.wuk.sh/api/json?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D${id}&isAudioOnly=true` : null,
  ].filter(Boolean);

  return tryApis(apis, (r) => {
    const u = r?.data?.dl || r?.url || r?.result?.url || r?.audio || r?.data?.audio ||
              r?.data?.url || r?.result?.audio || r?.dl_link || r?.result?.dl || r?.downloadUrl;
    const t = r?.data?.title || r?.title || r?.result?.title || r?.metadata?.title || query;
    if (u) return { title: t, url: u };
    return null;
  }, 'YT-AUDIO');
}

async function youtubeVideo(query) {
  const url = await searchYoutube(query);

  const apis = [
    `https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(url)}`,
    `https://api.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(url)}`,
    `https://api.akuari.my.id/downloader/youtubevideo?link=${encodeURIComponent(url)}`,
    `https://api.dreaded.site/api/ytdl/video?url=${encodeURIComponent(url)}`,
    `https://api.nyxs.pw/dl/yt?url=${encodeURIComponent(url)}`,
    `https://itzpire.com/download/youtube-video?url=${encodeURIComponent(url)}`,
  ];

  return tryApis(apis, (r) => {
    const u = r?.data?.dl || r?.url || r?.result?.url || r?.video || r?.data?.video ||
              r?.data?.url || r?.result?.video || r?.dl_link || r?.downloadUrl;
    const t = r?.data?.title || r?.title || r?.result?.title || query;
    if (u) return { title: t, url: u };
    return null;
  }, 'YT-VIDEO');
}

// ==================== TIKTOK ====================
async function tiktok(url) {
  const apis = [
    `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
    `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`,
    `https://api.siputzx.my.id/api/tiktok?url=${encodeURIComponent(url)}`,
    `https://api.davidcyriltech.my.id/download/tiktok?url=${encodeURIComponent(url)}`,
    `https://itzpire.com/download/tiktok?url=${encodeURIComponent(url)}`,
    `https://api.nyxs.pw/dl/tiktok?url=${encodeURIComponent(url)}`,
  ];
  return tryApis(apis, (r) => {
    const u = r?.data?.play || r?.data?.[0]?.url || r?.result?.video?.no_watermark ||
              r?.video?.noWatermark || r?.video || r?.result?.url || r?.url ||
              r?.data?.video?.noWatermark || r?.data?.noWatermark;
    const t = r?.data?.title || r?.title || r?.result?.title || 'TikTok';
    if (u) return { title: t, url: u };
    return null;
  }, 'TIKTOK');
}

// ==================== INSTAGRAM ====================
async function instagram(url) {
  const apis = [
    `https://api.siputzx.my.id/api/d/igdl?url=${encodeURIComponent(url)}`,
    `https://api.davidcyriltech.my.id/download/instagram?url=${encodeURIComponent(url)}`,
    `https://itzpire.com/download/instagram?url=${encodeURIComponent(url)}`,
    `https://api.nyxs.pw/dl/ig?url=${encodeURIComponent(url)}`,
  ];
  const r = await tryApis(apis, (r) => {
    const item = r?.data?.[0] || r?.result?.[0] || (r?.url ? { url: r.url } : null) ||
                 (r?.data?.url ? { url: r.data.url } : null);
    if (item?.url) return { url: item.url };
    return null;
  }, 'IG');
  return { type: r.url.includes('.mp4') ? 'video' : 'image', url: r.url };
}

// ==================== FACEBOOK ====================
async function facebook(url) {
  const apis = [
    `https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(url)}`,
    `https://api.davidcyriltech.my.id/download/facebook?url=${encodeURIComponent(url)}`,
    `https://itzpire.com/download/facebook?url=${encodeURIComponent(url)}`,
    `https://api.nyxs.pw/dl/fb?url=${encodeURIComponent(url)}`,
  ];
  return tryApis(apis, (r) => {
    const u = r?.data?.[0]?.url || r?.result?.url || r?.url || r?.data?.url ||
              r?.data?.hd || r?.data?.sd || r?.hd || r?.sd;
    if (u) return { url: u };
    return null;
  }, 'FB');
}

// ==================== TWITTER ====================
async function twitter(url) {
  const apis = [
    `https://api.siputzx.my.id/api/d/twitter?url=${encodeURIComponent(url)}`,
    `https://api.davidcyriltech.my.id/download/twitter?url=${encodeURIComponent(url)}`,
    `https://itzpire.com/download/twitter?url=${encodeURIComponent(url)}`,
  ];
  return tryApis(apis, (r) => {
    const u = r?.data?.[0]?.url || r?.result?.url || r?.url || r?.data?.url || r?.video;
    if (u) return { url: u };
    return null;
  }, 'TWITTER');
}

// ==================== SPOTIFY ====================
async function spotify(url) {
  const apis = [
    `https://api.siputzx.my.id/api/d/spotify?url=${encodeURIComponent(url)}`,
    `https://api.davidcyriltech.my.id/download/spotifydl?url=${encodeURIComponent(url)}`,
    `https://api.nyxs.pw/dl/spotify?url=${encodeURIComponent(url)}`,
  ];
  return tryApis(apis, (r) => {
    const u = r?.data?.url || r?.result?.url || r?.url || r?.data?.download;
    const t = r?.data?.title || r?.result?.title || r?.title || 'Spotify';
    if (u) return { title: t, url: u };
    return null;
  }, 'SPOTIFY');
}

// ==================== SOUNDCLOUD ====================
async function soundcloud(url) {
  const apis = [
    `https://api.siputzx.my.id/api/d/soundcloud?url=${encodeURIComponent(url)}`,
    `https://api.davidcyriltech.my.id/download/soundcloud?url=${encodeURIComponent(url)}`,
  ];
  return tryApis(apis, (r) => {
    const u = r?.data?.url || r?.result?.url || r?.url;
    const t = r?.data?.title || r?.title || 'SoundCloud';
    if (u) return { title: t, url: u };
    return null;
  }, 'SC');
}

// ==================== PINTEREST ====================
async function pinterest(url) {
  return tryApis([
    `https://api.siputzx.my.id/api/d/pinterest?url=${encodeURIComponent(url)}`,
    `https://api.nyxs.pw/dl/pinterest?url=${encodeURIComponent(url)}`,
  ], (r) => {
    const u = r?.data?.url || r?.result?.url || r?.url;
    if (u) return { url: u };
    return null;
  }, 'PINTEREST');
}

async function pinterestSearch(query) {
  return tryApis([
    `https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(query)}`,
    `https://api.dreaded.site/api/pinterest?query=${encodeURIComponent(query)}`,
  ], (r) => {
    const arr = r?.data || r?.result;
    if (Array.isArray(arr) && arr.length) {
      const pick = arr[Math.floor(Math.random() * Math.min(arr.length, 10))];
      return { url: pick.image || pick.url || pick.src || pick };
    }
    return null;
  }, 'PIN-SEARCH');
}

module.exports = {
  youtubeAudio, youtubeVideo, tiktok, instagram, facebook,
  twitter, spotify, soundcloud, pinterest, pinterestSearch, searchYoutube,
};
