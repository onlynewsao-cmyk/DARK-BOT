const config = require('../config');
const BotConfig = require('../database/models/BotConfig');

async function handle(sock, event) {
  try {
    const { id, participants, action } = event;
    if (!id.endsWith('@g.us')) return;

    const welcomeEnabled = await BotConfig.get('welcome_enabled', true).catch(() => true);
    if (!welcomeEnabled) return;

    const meta = await sock.groupMetadata(id).catch(() => null);
    const groupName = meta?.subject || 'grupo';

    for (const participant of participants) {
      const number = participant.split('@')[0];
      if (action === 'add') {
        const welcomeMsg = await BotConfig.get('welcome_message',
          `╭━〔 🌙 *BEM-VINDO* 〕━╮\n│ 👋 Olá @${number}!\n│ 🎉 Você entrou em *${groupName}*\n│ 🤖 Powered by ${config.bot.name}\n╰━━━━━━━━━━━━━━━━━╯`
        );
        const text = welcomeMsg.replace('@user', `@${number}`).replace('@grupo', groupName);
        try {
          const pp = await sock.profilePictureUrl(participant, 'image').catch(() => null);
          if (pp) {
            await sock.sendMessage(id, { image: { url: pp }, caption: text, mentions: [participant] });
          } else {
            await sock.sendMessage(id, { text, mentions: [participant] });
          }
        } catch (e) {
          await sock.sendMessage(id, { text, mentions: [participant] });
        }
      } else if (action === 'remove') {
        const byeMsg = await BotConfig.get('goodbye_message',
          `👋 @${number} saiu de *${groupName}*. Até mais!`
        );
        const text = byeMsg.replace('@user', `@${number}`).replace('@grupo', groupName);
        await sock.sendMessage(id, { text, mentions: [participant] }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Erro groupEvents:', err);
  }
}

module.exports = { handle };
