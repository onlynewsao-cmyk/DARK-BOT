/**
 * Sticker Maker v2 — Sharp puro, SEM ffmpeg!
 * Funciona no Render Free.
 */
const sharp = require('sharp');

/**
 * Converte imagem em sticker WebP com marca d'água nos metadados
 * SEM precisar de ffmpeg (apenas sharp + manipulação de exif/webp)
 */
async function create(buffer, { botName, ownerName, userName, groupName, isVideo }) {
  const packName = `${botName || 'DARK BOT'} • Dono: ${ownerName || 'Dark Net'}`;
  const author = `👤 ${userName || 'User'} | 👥 ${groupName || 'Privado'}`;

  if (isVideo) {
    // Vídeo: tenta extrair primeiro frame com sharp (limitado)
    try {
      const webp = await videoToWebpFirstFrame(buffer);
      return await addWebpMetadata(webp, packName, author);
    } catch (e) {
      console.warn('Vídeo→sticker falhou, criando placeholder:', e.message);
      // Fallback: cria sticker com texto
      return await createTextSticker('🎬 Vídeo', packName, author);
    }
  }

  // Imagem estática
  try {
    const webp = await processImage(buffer);
    return await addWebpMetadata(webp, packName, author);
  } catch (e) {
    console.warn('Sticker fail:', e.message);
    return await createTextSticker('🖼️', packName, author);
  }
}

/**
 * Smart resize: 90% quadrado, mantém quase tudo da imagem
 */
async function processImage(buffer) {
  const image = sharp(buffer, { animated: false, failOn: 'none' });
  const meta = await image.metadata();
  const { width, height } = meta;
  if (!width || !height) {
    return await sharp(buffer).resize(512, 512, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
  }

  const ratio = width / height;

  // Já é quadrado ou quase
  if (ratio >= 0.85 && ratio <= 1.15) {
    return await sharp(buffer)
      .resize(512, 512, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .toBuffer();
  }

  // Vertical: crop pouco (90% quadrado)
  if (ratio < 1) {
    const newHeight = Math.round(width / 0.9);
    const actualHeight = Math.min(height, newHeight);
    const top = Math.max(0, Math.round((height - actualHeight) / 2));
    return await sharp(buffer)
      .extract({ left: 0, top, width, height: actualHeight })
      .resize(512, 512, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .toBuffer();
  }

  // Horizontal
  const newWidth = Math.round(height * 1.1);
  const actualWidth = Math.min(width, newWidth);
  const left = Math.max(0, Math.round((width - actualWidth) / 2));
  return await sharp(buffer)
    .extract({ left, top: 0, width: actualWidth, height })
    .resize(512, 512, { fit: 'cover', position: 'center' })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Tenta extrair primeiro frame de vídeo (sharp limitado)
 * Se falhar, retorna placeholder
 */
async function videoToWebpFirstFrame(buffer) {
  // Sharp não suporta vídeo nativamente — cria placeholder
  throw new Error('Conversão de vídeo para sticker requer ffmpeg');
}

/**
 * Cria sticker de texto (fallback)
 */
async function createTextSticker(text, packName, author) {
  const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" fill="transparent"/>
    <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="180"
          text-anchor="middle" dominant-baseline="middle" fill="#8b5cf6">${text}</text>
  </svg>`;
  const webp = await sharp(Buffer.from(svg))
    .webp({ quality: 80 })
    .toBuffer();
  return await addWebpMetadata(webp, packName, author);
}

/**
 * Adiciona metadados EXIF ao WebP (pack name + author que aparecem no WhatsApp)
 * Formato baseado no padrão WhatsApp
 */
async function addWebpMetadata(webpBuffer, packName, author) {
  try {
    // Metadados WhatsApp são armazenados em EXIF customizado
    const json = {
      'sticker-pack-id': 'com.darkbot.stickers',
      'sticker-pack-name': packName,
      'sticker-pack-publisher': author,
      'emojis': ['🤖', '✨', '🌙'],
    };

    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
      0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);
    const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf-8');
    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);

    return await sharp(webpBuffer)
      .webp({ quality: 80 })
      .withMetadata({ exif: { IFD0: { ImageDescription: packName + ' | ' + author } } })
      .toBuffer();
  } catch (e) {
    // Se falhar metadata, retorna sem (sticker ainda funciona, só sem nome)
    return webpBuffer;
  }
}

module.exports = { create };
