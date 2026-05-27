/**
 * Downloader usando APIs gratuitas (sem precisar de ffmpeg/yt-dlp)
 * Ideal para Render Free que tem recursos limitados.
 */
const mediaHandler = require('./mediaHandler');

// ================== YOUTUBE ==================
async function youtubeAudio(query) {
  try {
    // Tenta API 1
    const search = await mediaHandler.fetchJson(`https://api.popcat.xyz/youtube?q=${encodeURIComponent(query)}`);
    const videoUrl = search?.url || (query.startsWith('http') ? query : null);
    if (!videoUrl) throw new Error('Não encontrado');

    // API de download de áudio
    const dl = await mediaHandler.fetchJson(`https://api.vevioz.com/api/button/mp3/${extractYtId(videoUrl)}`).catch(() => null);

    // Fallback: API alternativa
    const r = await mediaHandler.fetchJson(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(videoUrl)}`).catch(() => null);
    if (r?.data?.dl) return { title: r.data.title || query, url: r.data.dl };

    const r2 = await mediaHandler.fetchJson(`https://api.akuari.my.id/downloader/youtubeaudio?link=${encodeURIComponent(videoUrl)}`).catch(() => null);
    if (r2?.url) return { title: r2.title || query, url: r2.url };

    throw new Error('Nenhuma API funcionou');
  } catch (err) {
    throw new Error('YouTube indisponível: ' + err.message);
  }
}

async function youtubeVideo(query) {
  try {
    const search = await mediaHandler.fetchJson(`https://api.popcat.xyz/youtube?q=${encodeURIComponent(query)}`);
    const videoUrl = search?.url || (query.startsWith('http') ? query : null);
    if (!videoUrl) throw new Error('Não encontrado');

    const r = await mediaHandler.fetchJson(`https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(videoUrl)}`).catch(() => null);
    if (r?.data?.dl) return { title: r.data.title || query, url: r.data.dl };

    const r2 = await mediaHandler.fetchJson(`https://api.akuari.my.id/downloader/youtubevideo?link=${encodeURIComponent(videoUrl)}`).catch(() => null);
    if (r2?.url) return { title: r2.title || query, url: r2.url };

    throw new Error('Nenhuma API funcionou');
  } catch (err) {
    throw new Error('YouTube vídeo indisponível: ' + err.message);
  }
}

// ================== TIKTOK ==================
async function tiktok(url) {
  try {
    const r = await mediaHandler.fetchJson(`https://api.siputzx.my.id/api/tiktok?url=${encodeURIComponent(url)}`).catch(() => null);
    if (r?.data?.[0]?.url) return { title: r.data.title || 'TikTok', url: r.data[0].url };

    const r2 = await mediaHandler.fetchJson(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`).catch(() => null);
    if (r2?.data?.play) return { title: r2.data.title || 'TikTok', url: r2.data.play };

    throw new Error('Não encontrado');
  } catch (err) {
    throw new Error('TikTok indisponível: ' + err.message);
  }
}

// ================== INSTAGRAM ==================
async function instagram(url) {
  try {
    const r = await mediaHandler.fetchJson(`https://api.siputzx.my.id/api/d/igdl?url=${encodeURIComponent(url)}`).catch(() => null);
    if (r?.data?.[0]?.url) {
      const u = r.data[0].url;
      return { type: u.includes('.mp4') ? 'video' : 'image', url: u };
    }
    throw new Error('Não encontrado');
  } catch (err) {
    throw new Error('Instagram indisponível: ' + err.message);
  }
}

// ================== FACEBOOK ==================
async function facebook(url) {
  try {
    const r = await mediaHandler.fetchJson(`https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(url)}`).catch(() => null);
    if (r?.data?.[0]?.url) return { url: r.data[0].url };
    throw new Error('Não encontrado');
  } catch (err) {
    throw new Error('Facebook indisponível: ' + err.message);
  }
}

function extractYtId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : '';
}

module.exports = { youtubeAudio, youtubeVideo, tiktok, instagram, facebook };
