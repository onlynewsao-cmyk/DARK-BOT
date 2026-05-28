const { ytdl, PRINCE, searchYoutube, searchYoutubeFull, tryApis, streamToBuffer } = require('./helpers');

async function youtubeAudio(query) {
  const url = await searchYoutube(query);
  const info = await searchYoutubeFull(query);
  const fb = (info && info.title) || 'YouTube Audio';
  const apis = [
    PRINCE + '/dlmp3?apikey=prince&url=' + encodeURIComponent(url),
    PRINCE + '/ytmp3?apikey=prince&url=' + encodeURIComponent(url),
  ];
  try {
    return await tryApis(apis, r => {
      const u = (r && r.result && (r.result.download_url || r.result.url)) || (r && r.data && r.data.dl) || (r && r.url);
      return u ? { title: (r && r.result && r.result.title) || fb, url: u } : null;
    }, 'YT-AUDIO');
  } catch (e) {
    try {
      const vi = await ytdl.getInfo(url);
      const fmts = ytdl.filterFormats(vi.formats, 'audioonly');
      const best = fmts.find(f => f.audioBitrate >= 128) || fmts[0];
      if (best && best.url) return { title: vi.videoDetails.title || fb, url: best.url };
    } catch (er) {}
    throw e;
  }
}

async function youtubeAudioHD(query) {
  const url = await searchYoutube(query);
  const info = await searchYoutubeFull(query);
  const fb = (info && info.title) || 'YT HD';
  const apis = [
    PRINCE + '/dlmp3?apikey=prince&quality=320&url=' + encodeURIComponent(url),
    PRINCE + '/ytmp3?apikey=prince&url=' + encodeURIComponent(url),
  ];
  try {
    return await tryApis(apis, r => {
      const u = (r && r.result && (r.result.download_url || r.result.url)) || (r && r.url);
      return u ? { title: (r && r.result && r.result.title) || fb, url: u, quality: (r && r.result && r.result.quality) || '192kbps+' } : null;
    }, 'YT-AUDIO-HD');
  } catch (e) {
    try {
      const vi = await ytdl.getInfo(url);
      const best = ytdl.filterFormats(vi.formats, 'audioonly').sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
      if (best && best.url) return { title: vi.videoDetails.title || fb, url: best.url, quality: best.audioBitrate + 'kbps' };
    } catch (er) {}
    throw e;
  }
}

async function youtubeAudioBuffer(query) {
  const url = await searchYoutube(query);
  const stream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1 << 25 });
  const buffer = await streamToBuffer(stream);
  const info = await ytdl.getBasicInfo(url).catch(() => null);
  return { title: (info && info.videoDetails && info.videoDetails.title) || 'YouTube', buffer };
}

async function youtubeVideo(query) {
  const url = await searchYoutube(query);
  const info = await searchYoutubeFull(query);
  const fb = (info && info.title) || 'YouTube Video';
  const apis = [
    PRINCE + '/dlmp4?apikey=prince&url=' + encodeURIComponent(url),
    PRINCE + '/ytmp4?apikey=prince&url=' + encodeURIComponent(url),
  ];
  try {
    return await tryApis(apis, r => {
      const u = (r && r.result && (r.result.download_url || r.result.url)) || (r && r.url);
      return u ? { title: (r && r.result && r.result.title) || fb, url: u, quality: (r && r.result && r.result.quality) } : null;
    }, 'YT-VIDEO');
  } catch (e) {
    try {
      const vi = await ytdl.getInfo(url);
      const fmts = ytdl.filterFormats(vi.formats, 'audioandvideo').filter(f => f.container === 'mp4').sort((a, b) => (parseInt(b.qualityLabel) || 0) - (parseInt(a.qualityLabel) || 0));
      const best = fmts.find(f => parseInt(f.qualityLabel) <= 480) || fmts[0];
      if (best && best.url) return { title: vi.videoDetails.title || fb, url: best.url, quality: best.qualityLabel };
    } catch (er) {}
    throw e;
  }
}

async function youtubeVideoLow(query) {
  const url = await searchYoutube(query);
  const info = await searchYoutubeFull(query);
  const fb = (info && info.title) || 'YT';
  const apis = [
    PRINCE + '/dlmp4?apikey=prince&quality=144&url=' + encodeURIComponent(url),
    PRINCE + '/ytmp4?apikey=prince&url=' + encodeURIComponent(url),
  ];
  try {
    return await tryApis(apis, r => {
      const u = (r && r.result && (r.result.download_url || r.result.url)) || (r && r.url);
      return u ? { title: (r && r.result && r.result.title) || fb, url: u, quality: 'low' } : null;
    }, 'YT-VIDEO-LOW');
  } catch (e) {
    try {
      const vi = await ytdl.getInfo(url);
      const fmts = ytdl.filterFormats(vi.formats, 'audioandvideo').filter(f => f.container === 'mp4' && parseInt(f.qualityLabel) <= 360).sort((a, b) => (parseInt(a.qualityLabel) || 999) - (parseInt(b.qualityLabel) || 999));
      if (fmts[0] && fmts[0].url) return { title: vi.videoDetails.title || fb, url: fmts[0].url, quality: fmts[0].qualityLabel };
    } catch (er) {}
    throw e;
  }
}

module.exports = { youtubeAudio, youtubeAudioHD, youtubeAudioBuffer, youtubeVideo, youtubeVideoLow };
