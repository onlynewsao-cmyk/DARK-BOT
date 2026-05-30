/**
 * APNA Tunnel Lite (apnalite://) v2
 *
 * DESCOBERTA: APNA Lite usa o MESMO SDK Android que BD Net VPN!
 * - Mesma chave universal: "4%PdXch>fkP]" (12 bytes)
 * - Mesmo formato JSON
 * - Mesmo decrypt do payload interno
 *
 * → Reutiliza o parser do BD Net, mas troca o URI scheme e o appName.
 */
const bdnet = require('./bdnet');

async function parse(input, fileName) {
  // Normaliza input: troca apnalite:// por bdnet:// para reusar o parser
  let normalizedInput = input;
  if (Buffer.isBuffer(input)) {
    const s = input.toString('utf-8').trim();
    if (s.startsWith('apnalite://') || s.startsWith('apna://')) {
      const swapped = s.replace(/^apnalite:\/\//i, 'bdnet://').replace(/^apna:\/\//i, 'bdnet://');
      normalizedInput = Buffer.from(swapped, 'utf-8');
    }
  } else if (typeof input === 'string') {
    normalizedInput = input
      .replace(/^apnalite:\/\//i, 'bdnet://')
      .replace(/^apna:\/\//i, 'bdnet://');
  }

  // Usa o parser do BD Net (mesma chave e mesmo algoritmo!)
  const result = await bdnet.parse(normalizedInput, fileName);

  // Apenas troca os labels
  result.configType = 'APNA Tunnel Lite';
  result.appName = 'APNA Tunnel Lite';

  if (result.note && result.note.includes('Decrypt')) {
    result.note = result.note + ' [APNA Lite usa mesma chave do BD Net SDK]';
  }

  // Ajusta o fileName padrão se não houver friendly_name
  if (!result.allFields || !result.allFields.friendly_name) {
    result.configName = fileName ? fileName.replace(/\.(apnalite|apna|txt)$/i, '') : 'APNA Lite Config';
  }

  return result;
}

module.exports = { parse };
