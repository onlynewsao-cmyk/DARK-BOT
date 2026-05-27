/**
 * Sistema de Economia: coins, banco, trabalho, roubar, apostar, loja
 */
const Economy = require('../../database/models/Economy');

const reply = (sock, msg, ctx, text, mentions = []) =>
  sock.sendMessage(ctx.remoteJid, { text, mentions }, { quoted: msg });

function getMentions(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}
function pick(a) { return a[Math.floor(Math.random()*a.length)]; }
function randInt(a, b) { return Math.floor(Math.random()*(b-a+1))+a; }
function fmt(n) { return n.toLocaleString('pt-BR'); }

const ITEMS = {
  pao: { name: 'Pão', emoji: '🍞', price: 10, heal: 5 },
  pizza: { name: 'Pizza', emoji: '🍕', price: 50, heal: 20 },
  hamburguer: { name: 'Hambúrguer', emoji: '🍔', price: 75, heal: 30 },
  pocao: { name: 'Poção de Vida', emoji: '🧪', price: 200, heal: 100 },
  faca: { name: 'Faca', emoji: '🔪', price: 500, damage: 25 },
  arma: { name: 'Arma', emoji: '🔫', price: 2000, damage: 50 },
  colete: { name: 'Colete', emoji: '🦺', price: 1500, defense: 30 },
  carro: { name: 'Carro', emoji: '🚗', price: 10000, status: 'rico' },
  mansao: { name: 'Mansão', emoji: '🏰', price: 50000, status: 'magnata' },
  diamante: { name: 'Diamante', emoji: '💎', price: 100000, status: 'lendário' },
  caixa_misteriosa: { name: 'Caixa Misteriosa', emoji: '📦', price: 1000, mystery: true },
};

const TRABALHOS = [
  { name: 'pedreiro', emoji: '👷', min: 80, max: 200 },
  { name: 'taxista', emoji: '🚕', min: 100, max: 250 },
  { name: 'programador', emoji: '💻', min: 200, max: 500 },
  { name: 'médico', emoji: '👨‍⚕️', min: 300, max: 700 },
  { name: 'professor', emoji: '👨‍🏫', min: 150, max: 350 },
  { name: 'youtuber', emoji: '📹', min: 50, max: 1000 },
  { name: 'cozinheiro', emoji: '👨‍🍳', min: 100, max: 300 },
  { name: 'streamer', emoji: '🎮', min: 30, max: 800 },
];

const CRIMES = [
  { name: 'roubou um padaria', success: 200, fail: -100 },
  { name: 'invadiu um banco', success: 5000, fail: -2000 },
  { name: 'vendeu coisas suspeitas', success: 800, fail: -500 },
  { name: 'fez golpe do Pix', success: 1500, fail: -800 },
  { name: 'falsificou documento', success: 1000, fail: -700 },
];

function cooldown(last, ms) {
  if (!last) return 0;
  return Math.max(0, ms - (Date.now() - new Date(last).getTime()));
}
function formatCd(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return s + 's';
  if (s < 3600) return Math.ceil(s/60) + 'min';
  return Math.ceil(s/3600) + 'h';
}

module.exports = {
  async saldo({ sock, msg, ctx }) {
    const e = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    return reply(sock, msg, ctx,
      `╭━━〔 💰 *CARTEIRA* 〕━━╮\n` +
      `│ 👤 ${ctx.pushName}\n` +
      `│ 💵 Coins: ${fmt(e.coins)} 🪙\n` +
      `│ 🏦 Banco: ${fmt(e.bank)} 🪙\n` +
      `│ 💎 Total: ${fmt(e.coins + e.bank)}\n` +
      `│\n` +
      `│ ⭐ Level ${e.level} (${e.xp}/${e.level*100} XP)\n` +
      `│ ❤️ HP: ${e.hp}/${e.maxHp}\n` +
      `│\n` +
      `│ 🏆 Vitórias: ${e.wins}\n` +
      `│ 💀 Derrotas: ${e.losses}\n` +
      `╰━━━━━━━━━━━━━━━━━╯`);
  },

  async daily({ sock, msg, ctx }) {
    const e = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    const cd = cooldown(e.lastDaily, 24*3600*1000);
    if (cd > 0) return reply(sock, msg, ctx, `⏳ Já pegou hoje! Volte em ${formatCd(cd)}`);
    const reward = randInt(500, 1500);
    e.coins += reward; e.lastDaily = new Date(); e.totalEarned += reward;
    e.addXp(50);
    await e.save();
    return reply(sock, msg, ctx, `🎁 *DAILY!* +${fmt(reward)} 🪙\n⭐ +50 XP\n\n💰 Saldo: ${fmt(e.coins)}`);
  },

  async trabalhar({ sock, msg, ctx }) {
    const e = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    const cd = cooldown(e.lastWork, 60*60*1000);
    if (cd > 0) return reply(sock, msg, ctx, `😴 Cansado! Descanse mais ${formatCd(cd)}`);
    const job = pick(TRABALHOS);
    const reward = randInt(job.min, job.max);
    e.coins += reward; e.lastWork = new Date(); e.totalEarned += reward;
    e.addXp(20);
    await e.save();
    return reply(sock, msg, ctx, `${job.emoji} Você trabalhou como *${job.name}* e ganhou *${fmt(reward)} 🪙*\n⭐ +20 XP\n💰 Saldo: ${fmt(e.coins)}`);
  },

  async crime({ sock, msg, ctx }) {
    const e = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    const cd = cooldown(e.lastCrime, 2*60*60*1000);
    if (cd > 0) return reply(sock, msg, ctx, `🚓 A polícia tá te procurando! Aguarde ${formatCd(cd)}`);
    const c = pick(CRIMES);
    const success = Math.random() > 0.4;
    e.lastCrime = new Date();
    if (success) {
      e.coins += c.success; e.totalEarned += c.success; e.addXp(30);
      await e.save();
      return reply(sock, msg, ctx, `🦹 *${c.name.toUpperCase()}*\n\n✅ Sucesso! +${fmt(c.success)} 🪙\n💰 Saldo: ${fmt(e.coins)}`);
    } else {
      e.coins = Math.max(0, e.coins + c.fail); e.totalSpent += Math.abs(c.fail);
      await e.save();
      return reply(sock, msg, ctx, `🚓 *${c.name.toUpperCase()}*\n\n❌ Você foi pego! ${fmt(c.fail)} 🪙\n💰 Saldo: ${fmt(e.coins)}`);
    }
  },

  async pedir({ sock, msg, ctx }) {
    const e = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    const cd = cooldown(e.lastBeg, 30*60*1000);
    if (cd > 0) return reply(sock, msg, ctx, `🙏 Tenha vergonha! Espere ${formatCd(cd)}`);
    const amount = randInt(5, 100);
    e.coins += amount; e.lastBeg = new Date(); e.totalEarned += amount;
    await e.save();
    const reactions = ['Um senhor passou e te deu', 'Encontrou no chão', 'Um anjo apareceu e doou', 'A vovó deu'];
    return reply(sock, msg, ctx, `🙏 ${pick(reactions)} *${fmt(amount)} 🪙*`);
  },

  async roubar({ sock, msg, ctx }) {
    const targets = getMentions(msg);
    if (!targets.length) return reply(sock, msg, ctx, '🦹 Marque alguém: !roubar @fulano');
    const targetNum = targets[0].split('@')[0];
    if (targetNum === ctx.senderNumber) return reply(sock, msg, ctx, '🤡 Roubar de si mesmo?');
    const me = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    const cd = cooldown(me.lastRob, 60*60*1000);
    if (cd > 0) return reply(sock, msg, ctx, `🦹 Espere ${formatCd(cd)} pra roubar de novo`);
    const them = await Economy.getOrCreate(targetNum);
    if (them.coins < 50) return reply(sock, msg, ctx, `😂 @${targetNum} tá liso, nem vale a pena!`, [targets[0]]);
    me.lastRob = new Date();
    const success = Math.random() > 0.5;
    if (success) {
      const stolen = Math.floor(them.coins * (Math.random() * 0.3 + 0.1));
      them.coins -= stolen; me.coins += stolen;
      me.totalEarned += stolen;
      await me.save(); await them.save();
      return reply(sock, msg, ctx, `🦹 Você ROUBOU *${fmt(stolen)} 🪙* de @${targetNum}!`, [targets[0]]);
    } else {
      const fine = randInt(100, 500);
      me.coins = Math.max(0, me.coins - fine);
      await me.save();
      return reply(sock, msg, ctx, `🚓 Você foi pego tentando roubar @${targetNum} e pagou multa de *${fmt(fine)} 🪙*`, [targets[0]]);
    }
  },

  async depositar({ sock, msg, ctx, args }) {
    const e = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    const amount = args[0] === 'tudo' ? e.coins : parseInt(args[0]);
    if (!amount || amount < 1) return reply(sock, msg, ctx, '🏦 Use: !depositar <valor> ou !depositar tudo');
    if (amount > e.coins) return reply(sock, msg, ctx, `❌ Você só tem ${fmt(e.coins)} coins!`);
    e.coins -= amount; e.bank += amount;
    await e.save();
    return reply(sock, msg, ctx, `🏦 Depositado *${fmt(amount)} 🪙*\n💵 Carteira: ${fmt(e.coins)} | 🏦 Banco: ${fmt(e.bank)}`);
  },

  async sacar({ sock, msg, ctx, args }) {
    const e = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    const amount = args[0] === 'tudo' ? e.bank : parseInt(args[0]);
    if (!amount || amount < 1) return reply(sock, msg, ctx, '🏦 Use: !sacar <valor>');
    if (amount > e.bank) return reply(sock, msg, ctx, `❌ Banco só tem ${fmt(e.bank)}`);
    e.bank -= amount; e.coins += amount;
    await e.save();
    return reply(sock, msg, ctx, `💵 Sacado *${fmt(amount)} 🪙*\n💵 Carteira: ${fmt(e.coins)} | 🏦 Banco: ${fmt(e.bank)}`);
  },

  async transferir({ sock, msg, ctx, args }) {
    const targets = getMentions(msg);
    if (!targets.length) return reply(sock, msg, ctx, '💸 Use: !transferir @fulano <valor>');
    const amount = parseInt(args.find(a => !isNaN(parseInt(a))));
    if (!amount || amount < 1) return reply(sock, msg, ctx, '💸 Valor inválido');
    const me = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    if (me.coins < amount) return reply(sock, msg, ctx, `❌ Você só tem ${fmt(me.coins)}`);
    const targetNum = targets[0].split('@')[0];
    const them = await Economy.getOrCreate(targetNum);
    me.coins -= amount; them.coins += amount;
    await me.save(); await them.save();
    return reply(sock, msg, ctx, `✅ Transferiu *${fmt(amount)} 🪙* para @${targetNum}!`, [targets[0]]);
  },

  async apostar({ sock, msg, ctx, args }) {
    const amount = parseInt(args[0]);
    if (!amount || amount < 10) return reply(sock, msg, ctx, '🎰 Use: !apostar <valor> (mín 10)');
    const e = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    if (e.coins < amount) return reply(sock, msg, ctx, `❌ Você só tem ${fmt(e.coins)}`);
    const rolls = [randInt(1,9), randInt(1,9), randInt(1,9)];
    const emojis = ['🍒','🍋','🔔','💎','7️⃣','⭐','💰','🎰','🍀'];
    const display = rolls.map(r => emojis[r-1]).join(' | ');
    let multi = 0;
    if (rolls[0] === rolls[1] && rolls[1] === rolls[2]) multi = rolls[0] === 5 ? 10 : 5; // 777 = 10x, outros triplos 5x
    else if (rolls[0] === rolls[1] || rolls[1] === rolls[2] || rolls[0] === rolls[2]) multi = 2;
    if (multi > 0) {
      const win = amount * multi;
      e.coins += win - amount; e.wins++; e.totalEarned += win;
      e.addXp(10);
      await e.save();
      return reply(sock, msg, ctx, `🎰 *CAÇA-NÍQUEL*\n\n[ ${display} ]\n\n🎉 *GANHOU ${fmt(win)} 🪙* (x${multi})\n💰 Saldo: ${fmt(e.coins)}`);
    } else {
      e.coins -= amount; e.losses++; e.totalSpent += amount;
      await e.save();
      return reply(sock, msg, ctx, `🎰 *CAÇA-NÍQUEL*\n\n[ ${display} ]\n\n💀 Perdeu *${fmt(amount)} 🪙*\n💰 Saldo: ${fmt(e.coins)}`);
    }
  },

  async loja({ sock, msg, ctx }) {
    let text = `╭━━〔 🏪 *LOJA* 〕━━╮\n│\n`;
    for (const [key, item] of Object.entries(ITEMS)) {
      text += `│ ${item.emoji} *${item.name}* — ${fmt(item.price)} 🪙\n│   \`!comprar ${key}\`\n│\n`;
    }
    text += `╰━━━━━━━━━━━━━━━━━╯`;
    return reply(sock, msg, ctx, text);
  },

  async comprar({ sock, msg, ctx, args }) {
    const key = args[0]?.toLowerCase();
    if (!key) return reply(sock, msg, ctx, '🏪 Use: !comprar <item>\nVeja: !loja');
    const item = ITEMS[key];
    if (!item) return reply(sock, msg, ctx, '❌ Item inexistente');
    const e = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    if (e.coins < item.price) return reply(sock, msg, ctx, `❌ Faltam ${fmt(item.price - e.coins)} 🪙`);
    e.coins -= item.price; e.totalSpent += item.price;
    const existing = e.inventory.find(i => i.item === key);
    if (existing) existing.quantity++;
    else e.inventory.push({ item: key, quantity: 1 });
    await e.save();
    return reply(sock, msg, ctx, `🛒 Comprou *${item.emoji} ${item.name}*!\n💰 Saldo: ${fmt(e.coins)}`);
  },

  async inventario({ sock, msg, ctx }) {
    const e = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    if (!e.inventory.length) return reply(sock, msg, ctx, '🎒 Inventário vazio!');
    let text = `🎒 *INVENTÁRIO de ${ctx.pushName}*\n\n`;
    for (const inv of e.inventory) {
      const item = ITEMS[inv.item];
      if (item) text += `${item.emoji} *${item.name}* x${inv.quantity}\n`;
    }
    return reply(sock, msg, ctx, text);
  },

  async usar({ sock, msg, ctx, args }) {
    const key = args[0]?.toLowerCase();
    if (!key) return reply(sock, msg, ctx, '🎒 Use: !usar <item>');
    const e = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    const inv = e.inventory.find(i => i.item === key);
    if (!inv || inv.quantity < 1) return reply(sock, msg, ctx, '❌ Você não tem esse item');
    const item = ITEMS[key];
    let msgText = `🎒 Usou *${item.emoji} ${item.name}*`;
    if (item.heal) {
      e.hp = Math.min(e.maxHp, e.hp + item.heal);
      msgText += `\n❤️ +${item.heal} HP → ${e.hp}/${e.maxHp}`;
    }
    if (item.mystery) {
      const win = randInt(100, 5000);
      e.coins += win;
      msgText += `\n🎁 Surpresa! +${fmt(win)} 🪙`;
    }
    inv.quantity--;
    if (inv.quantity === 0) e.inventory = e.inventory.filter(i => i.item !== key);
    await e.save();
    return reply(sock, msg, ctx, msgText);
  },

  async heal({ sock, msg, ctx }) {
    const e = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    if (e.hp >= e.maxHp) return reply(sock, msg, ctx, `❤️ HP cheio: ${e.hp}/${e.maxHp}`);
    const cost = (e.maxHp - e.hp) * 2;
    if (e.coins < cost) return reply(sock, msg, ctx, `🏥 Custa ${fmt(cost)} 🪙 (você tem ${fmt(e.coins)})`);
    e.coins -= cost; e.hp = e.maxHp;
    await e.save();
    return reply(sock, msg, ctx, `🏥 Curado! HP: ${e.hp}/${e.maxHp}\n💸 Pagou ${fmt(cost)} 🪙`);
  },

  async ranking({ sock, msg, ctx, args }) {
    const tipo = args[0]?.toLowerCase() || 'coins';
    const sort = tipo === 'level' ? { level: -1, xp: -1 } :
                 tipo === 'wins' ? { wins: -1 } :
                 tipo === 'banco' ? { bank: -1 } :
                 { coins: -1 };
    const top = await Economy.find().sort(sort).limit(10);
    if (!top.length) return reply(sock, msg, ctx, '🏆 Ranking vazio');
    let text = `╭━━〔 🏆 *RANKING ${tipo.toUpperCase()}* 〕━━╮\n│\n`;
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
    const mentions = [];
    top.forEach((u, i) => {
      const val = tipo === 'level' ? `Lvl ${u.level}` :
                  tipo === 'wins' ? `${u.wins} 🏆` :
                  tipo === 'banco' ? `${fmt(u.bank)} 🏦` :
                  `${fmt(u.coins)} 🪙`;
      text += `│ ${medals[i]} @${u.whatsappNumber} — ${val}\n`;
      mentions.push(u.whatsappNumber + '@s.whatsapp.net');
    });
    text += `╰━━━━━━━━━━━━━━━━━━━╯\n_Tipos: coins, banco, level, wins_`;
    return reply(sock, msg, ctx, text, mentions);
  },

  async cassar({ sock, msg, ctx, args, isOwner }) {
    if (!isOwner) return reply(sock, msg, ctx, '🚫 Só Dono');
    const targets = getMentions(msg);
    if (!targets.length) return reply(sock, msg, ctx, '👑 Use: !cassar @user');
    const num = targets[0].split('@')[0];
    const e = await Economy.getOrCreate(num);
    e.coins = 0; e.bank = 0;
    await e.save();
    return reply(sock, msg, ctx, `👑 Patrimônio de @${num} CASSADO!`, [targets[0]]);
  },

  async dar({ sock, msg, ctx, args, isOwner }) {
    if (!isOwner) return reply(sock, msg, ctx, '🚫 Só Dono');
    const targets = getMentions(msg);
    if (!targets.length) return reply(sock, msg, ctx, '👑 Use: !dar @user <valor>');
    const amount = parseInt(args.find(a => !isNaN(parseInt(a))));
    if (!amount) return reply(sock, msg, ctx, '❌ Valor inválido');
    const num = targets[0].split('@')[0];
    const e = await Economy.getOrCreate(num);
    e.coins += amount;
    await e.save();
    return reply(sock, msg, ctx, `👑 Deu ${fmt(amount)} 🪙 para @${num}`, [targets[0]]);
  },
};
