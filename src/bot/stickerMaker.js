const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const sharp = require('sharp');

/**
 * Cria sticker com marca d'água + crop leve (90% quadrado)
 * Mantém quase toda a imagem original, só ajusta proporção.
 */
async function create(buffer, { botName, ownerName, userName, groupName, isVideo }) {
  const pack = `${botName} • Dono: ${ownerName}`;
  const author = `👤 ${userName} | 👥 ${groupName}`;

  let processedBuffer = buffer;

  // Pré-processa SÓ imagens estáticas (não vídeos/gifs)
  if (!isVideo) {
    try {
      processedBuffer = await processImage(buffer);
    } catch (e) {
      console.warn('Pré-processamento da imagem falhou, usando original:', e.message);
      processedBuffer = buffer;
    }
  }

  const sticker = new Sticker(processedBuffer, {
    pack,
    author,
    // CROPPED tipo deixa mais quadrado mas mantém o conteúdo
    type: StickerTypes.CROPPED,
    categories: ['🤖'],
    id: `dark-bot-${Date.now()}`,
    quality: 70,
    background: 'transparent',
  });

  return sticker.toBuffer();
}

/**
 * Smart resize:
 * - Imagem quase quadrada (0.85 - 1.15 ratio): mantém como está
 * - Imagem muito vertical/horizontal: crop pra ficar ~90% quadrado
 * - Resize final pra 512x512 (padrão WhatsApp)
 */
async function processImage(buffer) {
  const image = sharp(buffer, { animated: false });
  const meta = await image.metadata();
  const { width, height } = meta;
  if (!width || !height) return buffer;

  const ratio = width / height;

  // Já é quadrado ou quase: só resize
  if (ratio >= 0.85 && ratio <= 1.15) {
    return await sharp(buffer).resize(512, 512, { fit: 'cover', position: 'center' }).webp({ quality: 80 }).toBuffer();
  }

  // Vertical: crop pra ficar ~90% quadrado (mantém um pouco de proporção)
  if (ratio < 1) {
    const newHeight = Math.round(width / 0.9); // pouco mais alto que quadrado
    const actualHeight = Math.min(height, newHeight);
    const top = Math.round((height - actualHeight) / 2);
    return await sharp(buffer)
      .extract({ left: 0, top, width, height: actualHeight })
      .resize(512, 512, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .toBuffer();
  }

  // Horizontal: corta laterais
  const newWidth = Math.round(height * 1.1); // pouco mais largo
  const actualWidth = Math.min(width, newWidth);
  const left = Math.round((width - actualWidth) / 2);
  return await sharp(buffer)
    .extract({ left, top: 0, width: actualWidth, height })
    .resize(512, 512, { fit: 'cover', position: 'center' })
    .webp({ quality: 80 })
    .toBuffer();
}

module.exports = { create };
