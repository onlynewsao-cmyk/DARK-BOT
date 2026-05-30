/**
 * Pacote de INTERAÇÕES — abraçar, beijar, casar, etc
 * Cada comando aceita @marcação e gera mensagem divertida
 */
const Economy = require('../../database/models/Economy');

function getMentions(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}
const reply = (sock, msg, ctx, text, mentions = []) =>
  sock.sendMessage(ctx.remoteJid, { text, mentions }, { quoted: msg });

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/**
 * Cria um comando de ação social padrão
 */
function action({ name, emoji, verbs, soloVerbs = ['está sozinho 🥲'], damage = 0 }) {
  return async ({ sock, msg, ctx }) => {
    const targets = getMentions(msg);
    const sender = ctx.senderJid;
    if (!targets.length) {
      return reply(sock, msg, ctx, `${emoji} @${sender.split('@')[0]} ${pick(soloVerbs)}`, [sender]);
    }
    const target = targets[0];
    if (target === sender) {
      return reply(sock, msg, ctx, `🤡 @${sender.split('@')[0]} tentou ${name} a si mesmo... que triste 💀`, [sender]);
    }
    const verb = pick(verbs);
    let text = `${emoji} @${sender.split('@')[0]} ${verb} @${target.split('@')[0]}!`;
    if (damage > 0 && Math.random() > 0.5) {
      try {
        const eco = await Economy.getOrCreate(target.split('@')[0]);
        eco.hp = Math.max(0, eco.hp - damage);
        await eco.save();
        text += `\n\n💔 HP de @${target.split('@')[0]}: ${eco.hp}/${eco.maxHp}`;
        if (eco.hp === 0) text += `\n☠️ DESMAIOU! Use !heal para recuperar.`;
      } catch (e) {}
    }
    return reply(sock, msg, ctx, text, [sender, target]);
  };
}

module.exports = {
  // ============ AMOR / CARINHO ============
  abracar: action({
    name: 'abraçar', emoji: '🤗',
    verbs: ['deu um abraço apertado em', 'envolveu carinhosamente', 'mandou um abracinho para', 'esmagou de carinho'],
    soloVerbs: ['precisa de um abraço 🥺', 'tá carente, alguém abraça?'],
  }),
  beijar: action({
    name: 'beijar', emoji: '😘',
    verbs: ['deu um beijão em', 'roubou um beijo de', 'beijou apaixonadamente', 'mandou beijo no ar para'],
    soloVerbs: ['tá precisando de carinho 💋'],
  }),
  cafune: action({
    name: 'fazer cafuné', emoji: '🥰',
    verbs: ['fez cafuné em', 'acariciou a cabecinha de', 'mimou'],
  }),
  declarar: action({
    name: 'declarar amor', emoji: '💌',
    verbs: ['se declarou para', 'mandou uma carta de amor para', 'jurou amor eterno a'],
  }),
  flertar: action({
    name: 'flertar', emoji: '😏',
    verbs: ['deu uma piscadinha para', 'flertou descaradamente com', 'mandou olhar 43 para'],
  }),
  paparico: action({
    name: 'paparicar', emoji: '✨',
    verbs: ['paparicou', 'mimou demais', 'tratou como bebê'],
  }),

  // ============ VIOLÊNCIA (com HP) ============
  tapa: action({
    name: 'dar tapa', emoji: '👋',
    verbs: ['deu um TAPA na cara de', 'mandou um chinelão em', 'estalou a mão em'],
    damage: 5,
  }),
  soco: action({
    name: 'dar soco', emoji: '🥊',
    verbs: ['deu um SOCO em', 'mandou um direto em', 'nocauteou'],
    damage: 15,
  }),
  chute: action({
    name: 'chutar', emoji: '🦵',
    verbs: ['deu um chutão em', 'mandou voar', 'meteu o pé em'],
    damage: 10,
  }),
  tiro: action({
    name: 'dar tiro', emoji: '🔫',
    verbs: ['deu um TIRO em', 'meteu chumbo em', 'descarregou a glock em'],
    damage: 30,
  }),
  facada: action({
    name: 'esfaquear', emoji: '🔪',
    verbs: ['ESFAQUEOU', 'cravou a faca em', 'fez sushi de'],
    damage: 25,
  }),
  matar: action({
    name: 'matar', emoji: '💀',
    verbs: ['ELIMINOU', 'mandou pro além', 'rezou pela alma de'],
    damage: 100,
  }),
  bater: action({
    name: 'bater', emoji: '👊',
    verbs: ['deu uma surra em', 'mandou ver em', 'encheu de porrada'],
    damage: 12,
  }),
  morder: action({
    name: 'morder', emoji: '🦷',
    verbs: ['mordeu', 'arrancou um pedaço de', 'cravou os dentes em'],
    damage: 8,
  }),
  bullying: action({
    name: 'bullying', emoji: '😈',
    verbs: ['zoou pra caralho', 'meteu humilhação em', 'expôs publicamente'],
  }),

  // ============ DIVERSÃO ============
  cuspir: action({
    name: 'cuspir', emoji: '💦',
    verbs: ['cuspiu em', 'mandou saliva em', 'soltou o catarro em'],
  }),
  empurrar: action({
    name: 'empurrar', emoji: '➡️',
    verbs: ['empurrou', 'derrubou', 'jogou no chão'],
    damage: 3,
  }),
  acordar: action({
    name: 'acordar', emoji: '⏰',
    verbs: ['ACORDOU geral aos berros', 'jogou água em', 'fez o despertador tocar em'],
  }),
  cuidar: action({
    name: 'cuidar', emoji: '👨‍⚕️',
    verbs: ['cuidou de', 'fez carinho em', 'curou'],
  }),
  envenenar: action({
    name: 'envenenar', emoji: '☠️',
    verbs: ['envenenou o café de', 'colocou veneno na comida de', 'deu chá fatal a'],
    damage: 20,
  }),
  mimimi: action({
    name: 'fazer mimimi', emoji: '😭',
    verbs: ['fez mimimi pra', 'choramingou para', 'reclamou pra'],
  }),
  fofocar: action({
    name: 'fofocar', emoji: '🤫',
    verbs: ['fofocou sobre', 'inventou história de', 'soltou tudo sobre'],
  }),
  bencao: action({
    name: 'abençoar', emoji: '🙏',
    verbs: ['abençoou', 'rezou por', 'pediu graça por'],
  }),
  amaldicoar: action({
    name: 'amaldiçoar', emoji: '🧙',
    verbs: ['rogou praga em', 'amaldiçoou', 'jogou macumba em'],
  }),
  espancar: action({
    name: 'espancar', emoji: '🥵',
    verbs: ['espancou', 'massacrou', 'pulverizou'],
    damage: 35,
  }),

  // ============ PERCENTUAIS (zoação) ============
  ...generatePercentual({
    cmd: 'gay', label: 'gay', emoji: '🏳️‍🌈',
    msgs: ['100% Pride!', 'Tá no time! 💖', 'Suspeitíssimo...', 'Negativo, mlk', 'Confirmadíssimo'],
  }),
  ...generatePercentual({
    cmd: 'lindo', label: 'lindo(a)', emoji: '😍',
    msgs: ['Deus tá vendo isso!', 'Modelo da Vogue!', 'Tem que melhorar, vai', 'Coitadinho(a)...', 'Sai de mim Satanás'],
  }),
  ...generatePercentual({
    cmd: 'feio', label: 'feio(a)', emoji: '🥶',
    msgs: ['Coitado, espelho tá chorando', 'Tá tranquilo', 'Tudo bem assim', 'Beleza própria 😎'],
  }),
  ...generatePercentual({
    cmd: 'burro', label: 'burro(a)', emoji: '🤡',
    msgs: ['QI de minhoca', 'Tipo Einstein', 'Mediano', 'Inteligente demais', 'Genial'],
  }),
  ...generatePercentual({
    cmd: 'corno', label: 'corno', emoji: '🦌',
    msgs: ['CORNAÇO TOTAL', 'Suspeito', 'Tá safe', 'Imune ao chifre', 'O caçador, não a caça'],
  }),
  ...generatePercentual({
    cmd: 'rico', label: 'rico(a)', emoji: '💰',
    msgs: ['Bill Gates pobre perto', 'Classe média', 'Tá liso', 'Devendo pro santo'],
  }),
  ...generatePercentual({
    cmd: 'safado', label: 'safado(a)', emoji: '😏',
    msgs: ['Pecado mortal', 'Suspeito', 'Tá normal', 'Inocente', 'Anjinho'],
  }),
  ...generatePercentual({
    cmd: 'doido', label: 'doido(a)', emoji: '🤪',
    msgs: ['Surtou geral', 'Tá nervoso', 'Tranquilo', 'Sanidade plena'],
  }),
  ...generatePercentual({
    cmd: 'gostoso', label: 'gostoso(a)', emoji: '🥵',
    msgs: ['Pecaaaaado', 'Pra babar', 'Razoável', 'Tem que melhorar'],
  }),
  ...generatePercentual({
    cmd: 'malucao', label: 'maluco(a)', emoji: '🌀',
    msgs: ['Internação urgente!', 'Levemente desviado', 'Normal', 'Pessoa sã'],
  }),
};

function generatePercentual({ cmd, label, emoji, msgs }) {
  return {
    [cmd]: async ({ sock, msg, ctx }) => {
      const targets = getMentions(msg);
      const target = targets[0] || ctx.senderJid;
      const pct = randInt(0, 100);
      let comment;
      if (pct >= 80) comment = msgs[0];
      else if (pct >= 60) comment = msgs[1] || msgs[0];
      else if (pct >= 40) comment = msgs[2] || msgs[1];
      else if (pct >= 20) comment = msgs[3] || msgs[2];
      else comment = msgs[4] || msgs[3] || msgs[0];

      // Barra de progresso visual
      const filled = Math.floor(pct / 5);
      const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);

      const text = `${emoji} *MEDIDOR DE ${label.toUpperCase()}*\n\n` +
                   `👤 @${target.split('@')[0]}\n\n` +
                   `[${bar}] *${pct}%*\n\n` +
                   `💭 ${comment}`;
      return reply(sock, msg, ctx, text, [target]);
    },
  };
}
