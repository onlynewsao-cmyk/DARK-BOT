const { PRINCE, tryApis } = require('./helpers');

const DELIRIUS = 'https://api.delirius.store/download';
const BK9 = 'https://api.bk9.dev/download';

// ============ TIKTOK ============
async function tiktok(url) {
  const apis = [
    'https://www.tikwm.com/api/?url=' + encodeURIComponent(url),
    DELIRIUS + '/tiktok?url=' + encodeURIComponent(url),
    PRINCE + '/tiktokdl?apikey=prince&url=' + encodeURIComponent(url),
  ];
  return tryApis(apis, r => {
    // tikwm
    if (r && r.data && r.data.play) return { title: r.data.title || 'TikTok', url: r.data.play };
    // Delirius
    if (r && r.status === true && r.data) {
      const d = r.data;
      const u = d.url_video_hd || d.url_video || d.video_no_watermark || d.no_watermark || d.video || (d.videos && d.videos[0]);
      if (u) return { title: d.title || 'TikTok', url: typeof u === 'string' ? u : u.url };
    }
    // PrinceTech
    const pu = (r && r.result && r.result.video && r.result.video.no_watermark) ||
               (r && r.result && r.result.no_watermark) || (r && r.result && r.result.video);
    if (pu) return { title: (r && r.result && r.result.title) || 'TikTok', url: typeof pu === 'string' ? pu : pu.url };
    return null;
  }, 'TIKTOK');
}

// ============ INSTAGRAM (DELIRIUS FUNCIONA!) ============
async function instagram(url) {
  const apis = [
    DELIRIUS + '/instagram?url=' + encodeURIComponent(url),
    BK9 + '/instagram?url=' + encodeURIComponent(url),
    PRINCE + '/instagram?apikey=prince&url=' + encodeURIComponent(url),
  ];
  const r = await tryApis(apis, r => {
    // Delirius: data: [{ type: 'image'|'video', url: '...' }]
    if (r && r.status === true && Array.isArray(r.data) && r.data[0]) {
      const item = r.data[0];
      const u = item.url || item.download || item.video || item.image;
      if (u) return { url: u, type: item.type || (u.includes('.mp4') ? 'video' : 'image') };
    }
    // BK9: BK9: [{ type: 'image', url: '...', thumbnail: '...' }]
    if (r && r.BK9 && Array.isArray(r.BK9) && r.BK9[0]) {
      const item = r.BK9[0];
      const u = item.url || item.download || item.video || item.image || item.thumbnail;
      if (u) return { url: u, type: item.type || (u.includes('.mp4') ? 'video' : 'image') };
    }
    // PrinceTech
    if (r && r.result) {
      let item = null;
      if (Array.isArray(r.result)) item = r.result[0];
      else if (r.result.media && r.result.media[0]) item = r.result.media[0];
      else if (r.result.download_url || r.result.url) item = r.result;
      if (item) {
        const u = item.download_url || item.url || item.video || item.image;
        if (u) return { url: u, type: u.includes('.mp4') ? 'video' : 'image' };
      }
    }
    return null;
  }, 'IG');
  return { type: r.type || ((r.url || '').includes('.mp4') ? 'video' : 'image'), url: r.url };
}

// ============ FACEBOOK ============
async function facebook(url) {
  const apis = [
    DELIRIUS + '/facebook?url=' + encodeURIComponent(url),
    PRINCE + '/facebook?apikey=prince&url=' + encodeURIComponent(url),
    PRINCE + '/fbdl?apikey=prince&url=' + encodeURIComponent(url),
  ];
  return tryApis(apis, r => {
    // Delirius - retorna: { status:true, thumb, hd, sd, ... }
    if (r && r.status === true) {
      const u = r.hd || r.sd || r.url || r.video || r.download;
      if (u) return { url: u, title: r.title || 'Facebook' };
    }
    // PrinceTech - retorna: { result: { hd_video, sd_video } }
    const pu = (r && r.result && (r.result.hd_video || r.result.sd_video || r.result.video || r.result.url));
    if (pu) return { url: pu, title: (r && r.result && r.result.title) || 'Facebook' };
    return null;
  }, 'FB');
}

// ============ TWITTER (alternativas - APIs públicas instáveis) ============
async function twitter(url) {
  const apis = [
    DELIRIUS + '/twitter?url=' + encodeURIComponent(url),
    BK9 + '/twitter?url=' + encodeURIComponent(url),
    PRINCE + '/twitterdl?apikey=prince&url=' + encodeURIComponent(url),
    'https://www.tikwm.com/api/?url=' + encodeURIComponent(url), // tikwm tenta x.com às vezes
  ];
  return tryApis(apis, r => {
    if (!r) return null;
    if (r.status === true && r.data) {
      const u = r.data.url || r.data.video || r.data.hd || r.data.sd || (Array.isArray(r.data) && r.data[0]?.url);
      if (u) return { url: u };
    }
    if (r.BK9 && Array.isArray(r.BK9) && r.BK9[0]?.url) return { url: r.BK9[0].url };
    if (r.result && !r.result.error) {
      const u = r.result.hd_video || r.result.video || r.result.url || r.result.download_url;
      if (u) return { url: u };
    }
    if (r.data && r.data.play) return { url: r.data.play };
    return null;
  }, 'TWITTER');
}

// ============ SPOTIFY (DELIRIUS FUNCIONA!) ============
async function spotify(url) {
  const apis = [
    DELIRIUS + '/spotifydl?url=' + encodeURIComponent(url),
    PRINCE + '/spotifydl?apikey=prince&url=' + encodeURIComponent(url),
  ];
  return tryApis(apis, r => {
    // Delirius: { status:true, data: { title, author, download } }
    if (r && r.status === true && r.data) {
      const u = r.data.download || r.data.url;
      if (u) return { title: r.data.title || 'Spotify', url: u, author: r.data.author };
    }
    // PrinceTech
    if (r && r.result) {
      const u = r.result.download_url || r.result.url || r.result.audio;
      if (u) return { title: r.result.title || 'Spotify', url: u };
    }
    return null;
  }, 'SPOTIFY');
}

// ============ SOUNDCLOUD ============
async function soundcloud(url) {
  const apis = [
    DELIRIUS + '/soundcloud?url=' + encodeURIComponent(url),
    PRINCE + '/soundclouddl?apikey=prince&url=' + encodeURIComponent(url),
    PRINCE + '/soundcloud?apikey=prince&url=' + encodeURIComponent(url),
  ];
  return tryApis(apis, r => {
    if (r && r.status === true && r.data) {
      const u = r.data.download || r.data.url || r.data.audio;
      if (u) return { title: r.data.title || 'SoundCloud', url: u };
    }
    if (r && r.result) {
      const u = r.result.download_url || r.result.url || r.result.audio;
      if (u) return { title: r.result.title || 'SoundCloud', url: u };
    }
    return null;
  }, 'SC');
}

// ============ PINTEREST ============
async function pinterest(url) {
  const apis = [
    PRINCE + '/pinterestdl?apikey=prince&url=' + encodeURIComponent(url),
    PRINCE + '/pinterest?apikey=prince&url=' + encodeURIComponent(url),
  ];
  return tryApis(apis, r => {
    let u = null;
    if (r && r.result) {
      if (r.result.media && Array.isArray(r.result.media) && r.result.media[0]) {
        const video = r.result.media.find(m => m.type === 'Video' || m.format === 'MP4');
        const image = r.result.media.find(m => m.type === 'Image' || m.format === 'JPG' || m.format === 'PNG' || m.type === 'Thumbnail');
        u = (video || image || r.result.media[0]).download_url;
      } else {
        u = r.result.download_url || r.result.url || r.result.image || r.result.video;
      }
    }
    if (!u && r && r.data) u = r.data.url || r.data.image || r.data.video;
    if (!u && r && r.url) u = r.url;
    if (u) return { url: u, title: (r && r.result && r.result.title) || 'Pinterest' };
    return null;
  }, 'PINTEREST');
}

async function pinterestSearch(query) {
  const apis = [
    'https://api.princetechn.com/api/search/pinterest?apikey=prince&query=' + encodeURIComponent(query),
  ];
  return tryApis(apis, r => {
    const arr = (r && r.result) || (r && r.data) || (r && r.results);
    if (Array.isArray(arr) && arr.length) {
      const pick = arr[Math.floor(Math.random() * Math.min(arr.length, 10))];
      const u = (typeof pick === 'string') ? pick : (pick.image || pick.url || pick.src || pick.download_url || pick.thumbnail);
      if (u) return { url: u };
    }
    return null;
  }, 'PIN-SEARCH');
}

// ============ THREADS (bônus - Delirius suporta!) ============
async function threads(url) {
  const apis = [
    DELIRIUS + '/threads?url=' + encodeURIComponent(url),
  ];
  return tryApis(apis, r => {
    if (r && r.status === true && r.data) {
      const d = r.data;
      // data.media é array
      if (Array.isArray(d.media) && d.media[0]) {
        const m = d.media[0];
        const u = m.url || m.video || m.image;
        if (u) return { url: u, type: m.type || (u.includes('.mp4') ? 'video' : 'image'), title: d.full_name || 'Threads' };
      }
    }
    return null;
  }, 'THREADS');
}

module.exports = { tiktok, instagram, facebook, twitter, spotify, soundcloud, pinterest, pinterestSearch, threads };
