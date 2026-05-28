const { PRINCE, tryApis } = require('./helpers');

async function tiktok(url) {
  const apis = [
    'https://www.tikwm.com/api/?url=' + encodeURIComponent(url),
    PRINCE + '/tiktokdl?apikey=prince&url=' + encodeURIComponent(url),
  ];
  return tryApis(apis, r => {
    const u = (r && r.data && r.data.play) || (r && r.data && r.data[0] && r.data[0].url) ||
              (r && r.result && r.result.video && r.result.video.no_watermark) ||
              (r && r.result && r.result.no_watermark) || (r && r.result && r.result.video) ||
              (r && r.video && r.video.noWatermark) || (r && r.video) || (r && r.url);
    const t = (r && r.data && r.data.title) || (r && r.title) || (r && r.result && r.result.title) || 'TikTok';
    if (u) return { title: t, url: typeof u === 'string' ? u : (u && u.url) || u };
    return null;
  }, 'TIKTOK');
}

async function instagram(url) {
  const apis = [
    PRINCE + '/instagram?apikey=prince&url=' + encodeURIComponent(url),
    PRINCE + '/igdl?apikey=prince&url=' + encodeURIComponent(url),
    PRINCE + '/insta?apikey=prince&url=' + encodeURIComponent(url),
  ];
  const r = await tryApis(apis, r => {
    let item = null;
    if (r && r.result) {
      if (Array.isArray(r.result)) item = r.result[0];
      else if (r.result.media && r.result.media[0]) item = r.result.media[0];
      else if (r.result.download_url || r.result.url) item = r.result;
    }
    if (!item && r && r.data) item = Array.isArray(r.data) ? r.data[0] : r.data;
    if (!item) return null;
    const u = item.download_url || item.url || item.video || item.image;
    return u ? { url: u } : null;
  }, 'IG');
  return { type: (r.url && r.url.includes('.mp4')) ? 'video' : 'image', url: r.url };
}

async function facebook(url) {
  const apis = [
    PRINCE + '/facebook?apikey=prince&url=' + encodeURIComponent(url),
    PRINCE + '/fbdl?apikey=prince&url=' + encodeURIComponent(url),
    PRINCE + '/fb?apikey=prince&url=' + encodeURIComponent(url),
  ];
  return tryApis(apis, r => {
    const u = (r && r.result && (r.result.hd_video || r.result.sd_video || r.result.video || r.result.url || r.result.download_url)) ||
              (r && r.data && (r.data.hd || r.data.sd || r.data.url)) ||
              (r && r.url);
    if (u) return { url: u, title: (r && r.result && r.result.title) || 'Facebook' };
    return null;
  }, 'FB');
}

async function twitter(url) {
  const apis = [
    PRINCE + '/twitterdl?apikey=prince&url=' + encodeURIComponent(url),
    PRINCE + '/twitter?apikey=prince&url=' + encodeURIComponent(url),
  ];
  return tryApis(apis, r => {
    if (r && r.result && r.result.error) return null;
    const u = (r && r.result && (r.result.hd_video || r.result.video || r.result.download_url || r.result.url)) ||
              (r && r.data && (r.data.url || r.data.video)) ||
              (r && r.url);
    if (u) return { url: u };
    return null;
  }, 'TWITTER');
}

async function spotify(url) {
  const apis = [
    PRINCE + '/spotifydl?apikey=prince&url=' + encodeURIComponent(url),
    PRINCE + '/spotify?apikey=prince&url=' + encodeURIComponent(url),
  ];
  return tryApis(apis, r => {
    const u = (r && r.result && (r.result.download_url || r.result.url || r.result.audio)) ||
              (r && r.data && (r.data.url || r.data.download)) ||
              (r && r.url);
    const t = (r && r.result && r.result.title) || (r && r.title) || 'Spotify';
    if (u) return { title: t, url: u };
    return null;
  }, 'SPOTIFY');
}

async function soundcloud(url) {
  const apis = [
    PRINCE + '/soundclouddl?apikey=prince&url=' + encodeURIComponent(url),
    PRINCE + '/soundcloud?apikey=prince&url=' + encodeURIComponent(url),
    PRINCE + '/scdl?apikey=prince&url=' + encodeURIComponent(url),
  ];
  return tryApis(apis, r => {
    const u = (r && r.result && (r.result.download_url || r.result.url || r.result.audio)) ||
              (r && r.data && (r.data.url || r.data.download)) ||
              (r && r.url);
    const t = (r && r.result && r.result.title) || (r && r.title) || 'SoundCloud';
    if (u) return { title: t, url: u };
    return null;
  }, 'SC');
}

async function pinterest(url) {
  const apis = [
    PRINCE + '/pinterestdl?apikey=prince&url=' + encodeURIComponent(url),
    PRINCE + '/pinterest?apikey=prince&url=' + encodeURIComponent(url),
  ];
  return tryApis(apis, r => {
    let u = null;
    if (r && r.result) {
      if (r.result.media && Array.isArray(r.result.media) && r.result.media[0]) {
        // Prioriza Video, depois Image
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

module.exports = { tiktok, instagram, facebook, twitter, spotify, soundcloud, pinterest, pinterestSearch };
