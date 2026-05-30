/**
 * Sistema de Família: casar, divorciar, adotar, etc
 */
const Economy = require('../../database/models/Economy');

const reply = (sock, msg, ctx, text, mentions = []) =>
  sock.sendMessage(ctx.remoteJid, { text, mentions }, { quoted: msg });

function getMentions(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}

// Estado em memória para pedidos pendentes (limpa em 5min)
const pendingProposals = new Map();
const pendingAdoptions = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingProposals) if (now - v.time > 5 * 60 * 1000) pendingProposals.delete(k);
  for (const [k, v] of pendingAdoptions) if (now - v.time > 5 * 60 * 1000) pendingAdoptions.delete(k);
}, 60000);

module.exports = {
  async casar({ sock, msg, ctx }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '💍 Apenas em grupos!');
    const targets = getMentions(msg);
    if (!targets.length) return reply(sock, msg, ctx, '💍 Marque alguém para casar: !casar @fulano');

    const senderNum = ctx.senderNumber;
    const targetNum = targets[0].split('@')[0];
    if (targetNum === senderNum) return reply(sock, msg, ctx, '💀 Não pode casar consigo mesmo!');

    const me = await Economy.getOrCreate(senderNum, ctx.pushName);
    if (me.spouseNumber) return reply(sock, msg, ctx, `💔 Você já é casado com +${me.spouseNumber}!\nUse !divorciar antes.`);

    const them = await Economy.getOrCreate(targetNum);
    if (them.spouseNumber) return reply(sock, msg, ctx, `💔 @${targetNum} já é casado(a)!`, [targets[0]]);

    pendingProposals.set(targetNum, { from: senderNum, fromJid: ctx.senderJid, time: Date.now() });
    return reply(sock, msg, ctx,
      `💍 *PEDIDO DE CASAMENTO* 💍\n\n` +
      `@${senderNum} pediu @${targetNum} em casamento! 💖\n\n` +
      `@${targetNum}, responda:\n` +
      `✅ *!aceitar* — pra casar\n` +
      `❌ *!recusar* — pra dispensar\n\n` +
      `⏳ Você tem 5 minutos`,
      [ctx.senderJid, targets[0]]);
  },

  async aceitar({ sock, msg, ctx }) {
    const pending = pendingProposals.get(ctx.senderNumber);
    if (!pending) {
      // Talvez seja adoção
      const adoption = pendingAdoptions.get(ctx.senderNumber);
      if (adoption) {
        const me = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
        const parent = await Economy.getOrCreate(adoption.from);
        if (!me.parents.includes(adoption.from)) me.parents.push(adoption.from);
        if (!parent.children.includes(ctx.senderNumber)) parent.children.push(ctx.senderNumber);
        await me.save(); await parent.save();
        pendingAdoptions.delete(ctx.senderNumber);
        return reply(sock, msg, ctx,
          `👨‍👩‍👧 *ADOÇÃO REALIZADA!*\n\n` +
          `@${adoption.from} agora é responsável por @${ctx.senderNumber}! 💕`,
          [adoption.fromJid, ctx.senderJid]);
      }
      return reply(sock, msg, ctx, '❌ Você não tem propostas pendentes');
    }

    const me = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    const them = await Economy.getOrCreate(pending.from);

    me.spouseNumber = pending.from;
    me.marriedAt = new Date();
    them.spouseNumber = ctx.senderNumber;
    them.marriedAt = new Date();
    await me.save(); await them.save();

    pendingProposals.delete(ctx.senderNumber);

    return reply(sock, msg, ctx,
      `╭━━━〔 💒 *CASAMENTO* 〕━━━╮\n` +
      `┃\n` +
      `┃  💕 @${pending.from} & @${ctx.senderNumber}\n` +
      `┃\n` +
      `┃  Agora estão oficialmente\n` +
      `┃  casados no ${ctx.groupName || 'grupo'}!\n` +
      `┃\n` +
      `┃  💐 Parabéns! 🥂\n` +
      `╰━━━━━━━━━━━━━━━━━━━╯`,
      [pending.fromJid, ctx.senderJid]);
  },

  async recusar({ sock, msg, ctx }) {
    const pending = pendingProposals.get(ctx.senderNumber);
    if (pending) {
      pendingProposals.delete(ctx.senderNumber);
      return reply(sock, msg, ctx,
        `💔 @${ctx.senderNumber} recusou o pedido de @${pending.from}\n\n_Fila do banco do amor 🥲_`,
        [ctx.senderJid, pending.fromJid]);
    }
    const adoption = pendingAdoptions.get(ctx.senderNumber);
    if (adoption) {
      pendingAdoptions.delete(ctx.senderNumber);
      return reply(sock, msg, ctx, `🚫 @${ctx.senderNumber} recusou ser adotado por @${adoption.from}`,
        [ctx.senderJid, adoption.fromJid]);
    }
    return reply(sock, msg, ctx, '❌ Sem pedidos pendentes');
  },

  async divorciar({ sock, msg, ctx }) {
    const me = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    if (!me.spouseNumber) return reply(sock, msg, ctx, '💔 Você nem é casado, calma aí 😂');
    const spouseNum = me.spouseNumber;
    const them = await Economy.getOrCreate(spouseNum);
    me.spouseNumber = ''; me.marriedAt = null;
    them.spouseNumber = ''; them.marriedAt = null;
    // Multa
    me.coins = Math.max(0, me.coins - 500);
    await me.save(); await them.save();
    return reply(sock, msg, ctx,
      `💔 *DIVÓRCIO*\n\n` +
      `@${ctx.senderNumber} se divorciou de @${spouseNum}.\n` +
      `💸 Pensão paga: 500 coins`,
      [ctx.senderJid, spouseNum + '@s.whatsapp.net']);
  },

  async esposa({ sock, msg, ctx }) {
    const me = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    if (!me.spouseNumber) return reply(sock, msg, ctx, '💔 Você é solteiro(a)! Use !casar @alguém');
    const days = me.marriedAt ? Math.floor((Date.now() - me.marriedAt) / 86400000) : 0;
    return reply(sock, msg, ctx,
      `💍 Você é casado com @${me.spouseNumber}\n📅 Há ${days} dias juntos 💕`,
      [me.spouseNumber + '@s.whatsapp.net']);
  },

  async adotar({ sock, msg, ctx }) {
    const targets = getMentions(msg);
    if (!targets.length) return reply(sock, msg, ctx, '👶 Marque alguém: !adotar @fulano');
    const targetNum = targets[0].split('@')[0];
    if (targetNum === ctx.senderNumber) return reply(sock, msg, ctx, '🤡 Não pode se adotar!');
    pendingAdoptions.set(targetNum, { from: ctx.senderNumber, fromJid: ctx.senderJid, time: Date.now() });
    return reply(sock, msg, ctx,
      `👨‍👩‍👧 *PEDIDO DE ADOÇÃO*\n\n` +
      `@${ctx.senderNumber} quer adotar @${targetNum} como filho(a)!\n\n` +
      `@${targetNum}, responda:\n` +
      `✅ *!aceitar*\n❌ *!recusar*`,
      [ctx.senderJid, targets[0]]);
  },

  async expulsar({ sock, msg, ctx }) {
    const targets = getMentions(msg);
    if (!targets.length) return reply(sock, msg, ctx, '🏃 Marque um filho: !expulsar @filho');
    const targetNum = targets[0].split('@')[0];
    const me = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    if (!me.children.includes(targetNum)) return reply(sock, msg, ctx, '❌ Esse não é seu filho!');
    me.children = me.children.filter(x => x !== targetNum);
    const child = await Economy.getOrCreate(targetNum);
    child.parents = child.parents.filter(x => x !== ctx.senderNumber);
    await me.save(); await child.save();
    return reply(sock, msg, ctx,
      `🏃 @${ctx.senderNumber} expulsou @${targetNum} de casa!\n💔 Que tristeza...`,
      [ctx.senderJid, targets[0]]);
  },

  async familia({ sock, msg, ctx }) {
    const me = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    let text = `╭━━〔 👨‍👩‍👧 *MINHA FAMÍLIA* 〕━━╮\n│ 👤 @${ctx.senderNumber}\n`;
    if (me.spouseNumber) text += `│ 💍 Cônjuge: @${me.spouseNumber}\n`;
    else text += `│ 💔 Solteiro(a)\n`;
    text += `│\n`;
    if (me.parents.length) text += `│ 👴 Pais (${me.parents.length}):\n${me.parents.map(p => `│   • @${p}`).join('\n')}\n│\n`;
    if (me.children.length) text += `│ 👶 Filhos (${me.children.length}):\n${me.children.map(c => `│   • @${c}`).join('\n')}\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━━╯`;
    const mentions = [ctx.senderJid, ...me.parents.map(p => p+'@s.whatsapp.net'), ...me.children.map(c => c+'@s.whatsapp.net')];
    if (me.spouseNumber) mentions.push(me.spouseNumber+'@s.whatsapp.net');
    return reply(sock, msg, ctx, text, mentions);
  },
};
