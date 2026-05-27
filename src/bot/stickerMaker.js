const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const config = require('../config');

/**
 * Cria sticker com marca d'água nos metadados (author/pack).
 * O WhatsApp exibe author e pack ao tocar no sticker.
 */
async function create(buffer, { botName, ownerName, userName, groupName, isVideo }) {
  const pack = `${botName} • Dono: ${ownerName}`;
  const author = `👤 ${userName} | 👥 ${groupName}`;

  const sticker = new Sticker(buffer, {
    pack,
    author,
    type: StickerTypes.FULL,
    categories: ['🤖'],
    id: `dark-bot-${Date.now()}`,
    quality: 60,
    background: 'transparent',
  });

  return sticker.toBuffer();
}

module.exports = { create };
