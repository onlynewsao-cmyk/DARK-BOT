/**
 * Downloader v5 - APIs PrinceTech + fallback ytdl-core
 * Estrutura modular em dl/
 */
const helpers = require('./dl/helpers');
const social = require('./dl/social');
const others = require('./dl/others');

module.exports = {
  // helpers exportados
  extractYtId: helpers.extractYtId,
  searchYoutube: helpers.searchYoutube,
  searchYoutubeFull: helpers.searchYoutubeFull,
  // YouTube
  youtubeAudio: social.youtubeAudio,
  youtubeAudioHD: social.youtubeAudioHD,
  youtubeAudioBuffer: social.youtubeAudioBuffer,
  youtubeVideo: social.youtubeVideo,
  youtubeVideoLow: social.youtubeVideoLow,
  // Outros
  tiktok: others.tiktok,
  instagram: others.instagram,
  facebook: others.facebook,
  twitter: others.twitter,
  spotify: others.spotify,
  soundcloud: others.soundcloud,
  pinterest: others.pinterest,
  pinterestSearch: others.pinterestSearch,
  threads: others.threads,
};
