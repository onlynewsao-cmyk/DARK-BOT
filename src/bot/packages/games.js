/**
 * JOGOS multiplayer no grupo
 */
const GameSession = require('../../database/models/GameSession');
const Economy = require('../../database/models/Economy');

const reply = (sock, msg, ctx, text, mentions = []) =>
  sock.sendMessage(ctx.remoteJid, { text, mentions }, { quoted: msg });
const pick = a => a[Math.floor(Math.random()*a.length)];
const randInt = (a,b) => Math.floor(Math.random()*(b-a+1))+a;

// ============ FORCA ============
const PALAVRAS = [
  { word: 'WHATSAPP', dica: 'Aplicativo de mensagens' },
  { word: 'COMPUTADOR', dica: 'Máquina pra programar' },
  { word: 'ANGOLA', dica: 'País africano lusófono' },
  { word: 'BRASIL', dica: 'País sul-americano' },
  { word: 'DARKBOT', dica: 'O melhor bot do WhatsApp' },
  { word: 'PROGRAMACAO', dica: 'Arte de criar código' },
  { word: 'INTELIGENCIA', dica: 'Capacidade mental' },
  { word: 'TELEFONE', dica: 'Aparelho de comunicar' },
  { word: 'MUSICA', dica: 'Arte dos sons' },
  { word: 'FUTEBOL', dica: 'Esporte mais popular' },
  { word: 'CHOCOLATE', dica: 'Doce delicioso' },
  { word: 'AVENTURA', dica: 'História emocionante' },
  { word: 'CACHORRO', dica: 'Melhor amigo do homem' },
  { word: 'ESTUDAR', dica: 'O que estudantes fazem' },
  { word: 'INTERNET', dica: 'Rede mundial' },
];

// ============ QUIZ ============
const QUIZ = [
  { q: 'Qual o maior país do mundo em área?', opts: ['Rússia','China','EUA','Canadá'], a: 0 },
  { q: 'Capital de Angola?', opts: ['Luanda','Lubango','Huambo','Benguela'], a: 0 },
  { q: 'Quanto é 7 x 8?', opts: ['54','56','64','58'], a: 1 },
  { q: 'Quem pintou a Mona Lisa?', opts: ['Picasso','Van Gogh','Da Vinci','Michelangelo'], a: 2 },
  { q: 'Planeta mais próximo do Sol?', opts: ['Vênus','Mercúrio','Terra','Marte'], a: 1 },
  { q: 'Qual a moeda de Angola?', opts: ['Real','Kwanza','Euro','Dólar'], a: 1 },
  { q: 'Quem descobriu o Brasil?', opts: ['Colombo','Cabral','Vasco da Gama','Magalhães'], a: 1 },
  { q: 'Linguagem do Node.js?', opts: ['Python','JavaScript','Ruby','Go'], a: 1 },
  { q: 'Maior oceano?', opts: ['Atlântico','Índico','Pacífico','Ártico'], a: 2 },
  { q: 'Animal terrestre mais rápido?', opts: ['Leão','Guepardo','Cavalo','Gazela'], a: 1 },
  { q: 'Quantos continentes existem?', opts: ['5','6','7','8'], a: 2 },
  { q: 'Inventor da lâmpada?', opts: ['Tesla','Edison','Newton','Einstein'], a: 1 },
  { q: 'Elemento químico H?', opts: ['Hélio','Hidrogênio','Hierro','Hólmio'], a: 1 },
  { q: 'Quantos jogadores num time de futebol?', opts: ['9','10','11','12'], a: 2 },
  { q: 'Maior deserto do mundo?', opts: ['Sahara','Gobi','Atacama','Antártico'], a: 3 },
];

const TRIVIA_BUSCA = ['banana','elefante','xadrez','arco-íris','vulcão','dragão','tesouro','pirata','samurai','astronauta','cientista','feijoada','pescaria','dinossauro','sereia'];

const VERDADES = [
  'Qual foi seu pior mico?', 'Já roubou algo? Conta!', 'Quantos crushs você tem agora?',
  'Qual sua maior mentira?', 'Já chorou vendo desenho? Qual?', 'Sua pior nota na escola?',
  'Qual foi sua maior vergonha?', 'Já beijou alguém errado?', 'Tem alguém que você finge gostar?',
  'Conta um segredo que ninguém sabe', 'Qual sua maior insegurança?', 'O que mais odeia em si mesmo?',
  'Já cantou alto no chuveiro?', 'Sua maior obsessão estranha?', 'Já bisbilhotou celular de alguém?',
];

const DESAFIOS = [
  'Manda áudio cantando uma música!', 'Tira foto fazendo careta!', 'Manda foto do seu pé 🦶',
  'Liga pra um número aleatório!', 'Pede em casamento o último que falou no grupo!',
  'Mande figurinha de você dormindo!', 'Conte uma piada bem ruim!', 'Imite um animal por áudio!',
  'Mande um print do seu navegador!', 'Diga "eu te amo" pra alguém no grupo!',
  'Faça uma dança e mande vídeo!', 'Coma algo apimentado e grava!', 'Mande nudes (do seu sapato 👟)',
];

module.exports = {
  // ============ FORCA ============
  async forca({ sock, msg, ctx }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos!');
    const existing = await GameSession.findOne({ groupJid: ctx.remoteJid, game: 'forca', active: true });
    if (existing) {
      const guessed = existing.state.guessed || [];
      const word = existing.state.word;
      const display = word.split('').map(c => guessed.includes(c) ? c : '_').join(' ');
      return reply(sock, msg, ctx,
        `🎮 *FORCA em andamento*\n\n📝 \`${display}\`\n❌ Erros: ${existing.state.errors}/6\n💡 Dica: ${existing.state.hint}\n\nUse: !letra <X> ou !palavra <PALAVRA>`);
    }
    const word = pick(PALAVRAS);
    await GameSession.create({
      groupJid: ctx.remoteJid, game: 'forca', startedBy: ctx.senderNumber,
      state: { word: word.word, hint: word.dica, guessed: [], errors: 0 },
    });
    return reply(sock, msg, ctx,
      `🎮 *FORCA INICIADA!*\n\n` +
      `📝 \`${'_ '.repeat(word.word.length).trim()}\`\n` +
      `💡 Dica: *${word.dica}*\n\n` +
      `🔤 \`!letra X\` — adivinhar letra\n` +
      `📝 \`!palavra XXXXX\` — adivinhar palavra completa\n` +
      `🛑 \`!desistir\` — encerrar`);
  },

  async letra({ sock, msg, ctx, args }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos!');
    const session = await GameSession.findOne({ groupJid: ctx.remoteJid, game: 'forca', active: true });
    if (!session) return reply(sock, msg, ctx, '🎮 Inicie com !forca');
    const letter = (args[0] || '').toUpperCase().slice(0,1);
    if (!letter.match(/[A-Z]/)) return reply(sock, msg, ctx, '🔤 Letra inválida');
    const s = session.state;
    if (s.guessed.includes(letter)) return reply(sock, msg, ctx, `⚠️ Letra ${letter} já tentada`);
    s.guessed.push(letter);
    const correct = s.word.includes(letter);
    if (!correct) s.errors++;
    session.markModified('state'); await session.save();
    const display = s.word.split('').map(c => s.guessed.includes(c) ? c : '_').join(' ');
    const won = !display.includes('_');
    const lost = s.errors >= 6;
    if (won || lost) {
      session.active = false; session.endedAt = new Date();
      session.winner = won ? ctx.senderNumber : '';
      await session.save();
      const eco = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
      if (won) { const r = 500; eco.coins += r; eco.wins++; eco.addXp(50); await eco.save();
        return reply(sock, msg, ctx, `🏆 *@${ctx.senderNumber} VENCEU!*\n\n📝 Palavra: *${s.word}*\n💰 +${r} 🪙 e +50 XP`, [ctx.senderJid]);
      }
      return reply(sock, msg, ctx, `💀 *PERDERAM!*\n\n📝 A palavra era: *${s.word}*`);
    }
    return reply(sock, msg, ctx,
      `${correct ? '✅' : '❌'} Letra: *${letter}*\n\n📝 \`${display}\`\n❌ Erros: ${s.errors}/6\n🔤 Tentadas: ${s.guessed.join(', ')}`);
  },

  async palavra({ sock, msg, ctx, args }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos!');
    const session = await GameSession.findOne({ groupJid: ctx.remoteJid, game: 'forca', active: true });
    if (!session) return reply(sock, msg, ctx, '🎮 Inicie com !forca');
    const guess = (args.join(' ') || '').toUpperCase();
    if (guess === session.state.word) {
      session.active = false; session.endedAt = new Date(); session.winner = ctx.senderNumber;
      await session.save();
      const eco = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
      const r = 1000; eco.coins += r; eco.wins++; eco.addXp(100); await eco.save();
      return reply(sock, msg, ctx, `🏆 *@${ctx.senderNumber} VENCEU!*\n\n📝 Palavra: *${session.state.word}*\n💰 +${r} 🪙 e +100 XP`, [ctx.senderJid]);
    } else {
      session.state.errors += 2;
      session.markModified('state'); await session.save();
      if (session.state.errors >= 6) {
        session.active = false; await session.save();
        return reply(sock, msg, ctx, `💀 *PERDERAM!*\n\nPalavra errada e morreram.\n📝 Era: *${session.state.word}*`);
      }
      return reply(sock, msg, ctx, `❌ Errou! Penalidade +2 erros (${session.state.errors}/6)`);
    }
  },

  async desistir({ sock, msg, ctx }) {
    const session = await GameSession.findOne({ groupJid: ctx.remoteJid, active: true });
    if (!session) return reply(sock, msg, ctx, '🎮 Sem jogo ativo');
    session.active = false; session.endedAt = new Date();
    await session.save();
    const txt = session.state.word ? `\n📝 Palavra era: *${session.state.word}*` : '';
    return reply(sock, msg, ctx, `🛑 Jogo *${session.game}* cancelado.${txt}`);
  },

  // ============ QUIZ ============
  async quiz({ sock, msg, ctx }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos!');
    const ex = await GameSession.findOne({ groupJid: ctx.remoteJid, game: 'quiz', active: true });
    if (ex) return reply(sock, msg, ctx, `🎮 Quiz já em andamento!\nResponda: !resp <1-4>`);
    const q = pick(QUIZ);
    await GameSession.create({
      groupJid: ctx.remoteJid, game: 'quiz', startedBy: ctx.senderNumber,
      state: { question: q.q, options: q.opts, correct: q.a, answered: [] },
    });
    return reply(sock, msg, ctx,
      `🧠 *QUIZ!*\n\n❓ ${q.q}\n\n` +
      q.opts.map((o,i) => `*${i+1}.* ${o}`).join('\n') +
      `\n\nResponda: !resp <1-4>\n⏱️ Vale 300 🪙 + 30 XP`);
  },

  async resp({ sock, msg, ctx, args }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos!');
    const session = await GameSession.findOne({ groupJid: ctx.remoteJid, game: 'quiz', active: true });
    if (!session) return reply(sock, msg, ctx, '🎮 Inicie com !quiz');
    if (session.state.answered.includes(ctx.senderNumber)) return reply(sock, msg, ctx, '⚠️ Você já respondeu');
    const choice = parseInt(args[0]) - 1;
    if (isNaN(choice) || choice < 0 || choice > 3) return reply(sock, msg, ctx, '❌ Use !resp 1-4');
    session.state.answered.push(ctx.senderNumber);
    session.markModified('state'); await session.save();
    if (choice === session.state.correct) {
      session.active = false; session.endedAt = new Date(); session.winner = ctx.senderNumber;
      await session.save();
      const eco = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
      eco.coins += 300; eco.wins++; eco.addXp(30); await eco.save();
      return reply(sock, msg, ctx,
        `🏆 *@${ctx.senderNumber} ACERTOU!*\n\n` +
        `✅ Resposta: *${session.state.options[session.state.correct]}*\n` +
        `💰 +300 🪙 e +30 XP`, [ctx.senderJid]);
    }
    return reply(sock, msg, ctx, `❌ @${ctx.senderNumber} errou! (${session.state.answered.length} já tentaram)`, [ctx.senderJid]);
  },

  // ============ ADIVINHA NÚMERO ============
  async adivinha({ sock, msg, ctx }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos!');
    const ex = await GameSession.findOne({ groupJid: ctx.remoteJid, game: 'adivinha', active: true });
    if (ex) return reply(sock, msg, ctx, `🎯 Jogo em andamento!\nUse !chute <número>`);
    const n = randInt(1, 100);
    await GameSession.create({
      groupJid: ctx.remoteJid, game: 'adivinha', startedBy: ctx.senderNumber,
      state: { number: n, attempts: 0, tried: [] },
    });
    return reply(sock, msg, ctx, `🎯 *ADIVINHA O NÚMERO!*\n\nPensei num número entre *1 e 100*.\n\nUse: !chute <número>\n💰 Prêmio: 500 🪙`);
  },

  async chute({ sock, msg, ctx, args }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos!');
    const session = await GameSession.findOne({ groupJid: ctx.remoteJid, game: 'adivinha', active: true });
    if (!session) return reply(sock, msg, ctx, '🎯 Inicie com !adivinha');
    const guess = parseInt(args[0]);
    if (isNaN(guess)) return reply(sock, msg, ctx, '❌ Use !chute <número>');
    session.state.attempts++;
    session.state.tried.push(`${ctx.pushName}: ${guess}`);
    session.markModified('state'); await session.save();
    if (guess === session.state.number) {
      session.active = false; session.winner = ctx.senderNumber; await session.save();
      const eco = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
      eco.coins += 500; eco.wins++; eco.addXp(50); await eco.save();
      return reply(sock, msg, ctx, `🏆 *@${ctx.senderNumber} ACERTOU!*\nNúmero era *${guess}* (${session.state.attempts} tentativas)\n💰 +500 🪙 e +50 XP`, [ctx.senderJid]);
    }
    const hint = guess < session.state.number ? '⬆️ MAIOR' : '⬇️ MENOR';
    return reply(sock, msg, ctx, `${hint} que ${guess}! (tentativa ${session.state.attempts})`);
  },

  // ============ BLACKJACK (21) ============
  async blackjack({ sock, msg, ctx, args }) {
    const bet = parseInt(args[0]) || 100;
    if (bet < 10) return reply(sock, msg, ctx, '🎲 Aposta mínima: 10. Use !blackjack <valor>');
    const eco = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    if (eco.coins < bet) return reply(sock, msg, ctx, `❌ Você só tem ${eco.coins}`);
    // Joga rápido contra o dealer
    const deck = newDeck();
    const player = [drawCard(deck), drawCard(deck)];
    const dealer = [drawCard(deck), drawCard(deck)];
    while (sumHand(dealer) < 17) dealer.push(drawCard(deck));
    while (sumHand(player) < 17 && Math.random() > 0.4) player.push(drawCard(deck));
    const pSum = sumHand(player), dSum = sumHand(dealer);
    let result, winnings;
    if (pSum > 21) { result = '💀 ESTOUROU! Perdeu'; winnings = -bet; }
    else if (dSum > 21 || pSum > dSum) { result = '🏆 GANHOU!'; winnings = bet; }
    else if (pSum === dSum) { result = '🤝 Empate'; winnings = 0; }
    else { result = '💀 Dealer venceu'; winnings = -bet; }
    eco.coins += winnings;
    if (winnings > 0) { eco.wins++; eco.addXp(20); }
    else if (winnings < 0) eco.losses++;
    await eco.save();
    return reply(sock, msg, ctx,
      `♠️ *BLACKJACK 21* ♣️\n\n` +
      `🧑 Você: ${player.join(' ')} = *${pSum}*\n` +
      `🤖 Dealer: ${dealer.join(' ')} = *${dSum}*\n\n` +
      `${result}\n💰 ${winnings >= 0 ? '+' : ''}${winnings} 🪙`);
  },

  // ============ ROLETA RUSSA ============
  async russa({ sock, msg, ctx }) {
    const bullet = randInt(1, 6);
    const eco = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    if (bullet === 1) {
      eco.hp = 0; eco.losses++; await eco.save();
      return reply(sock, msg, ctx,
        `🔫 *ROLETA RUSSA*\n\n💥 BANG! @${ctx.senderNumber} morreu!\n☠️ HP zerado\n\n_Use !heal_`, [ctx.senderJid]);
    }
    const reward = randInt(100, 500); eco.coins += reward; eco.wins++; eco.addXp(20); await eco.save();
    return reply(sock, msg, ctx,
      `🔫 *ROLETA RUSSA*\n\n🎯 *Click!* @${ctx.senderNumber} sobreviveu! (1 em 6)\n💰 +${reward} 🪙`, [ctx.senderJid]);
  },

  // ============ VERDADE OU DESAFIO ============
  async verdade({ sock, msg, ctx }) {
    return reply(sock, msg, ctx, `🟢 *VERDADE:*\n\n_${pick(VERDADES)}_`);
  },
  async desafio({ sock, msg, ctx }) {
    return reply(sock, msg, ctx, `🔴 *DESAFIO:*\n\n_${pick(DESAFIOS)}_`);
  },
  async vd({ sock, msg, ctx }) {
    if (Math.random() > 0.5) return reply(sock, msg, ctx, `🟢 *VERDADE:*\n\n_${pick(VERDADES)}_`);
    return reply(sock, msg, ctx, `🔴 *DESAFIO:*\n\n_${pick(DESAFIOS)}_`);
  },

  // ============ AKINATOR FAKE ============
  async akinator({ sock, msg, ctx }) {
    const respostas = [
      'É homem? 🤔', 'É famoso? 🌟', 'Tá vivo? 💀', 'É brasileiro? 🇧🇷', 'É jogador de futebol? ⚽',
      'É político? 🏛️', 'É cantor? 🎤', 'Aparece na TV? 📺',
    ];
    return reply(sock, msg, ctx, `🧞 *AKINATOR*\n\nResponda:\n*${pick(respostas)}*\n\n_(em breve: jogo completo)_`);
  },

  // ============ BINGO ============
  async bingo({ sock, msg, ctx }) {
    if (!ctx.isGroup) return reply(sock, msg, ctx, '👥 Só em grupos!');
    const numbers = [];
    while (numbers.length < 5) {
      const n = randInt(1, 75);
      if (!numbers.includes(n)) numbers.push(n);
    }
    const cartela = numbers.sort((a,b)=>a-b).join(' • ');
    const sorteado = randInt(1, 75);
    const ganhou = numbers.includes(sorteado);
    const eco = await Economy.getOrCreate(ctx.senderNumber, ctx.pushName);
    if (ganhou) { eco.coins += 1000; eco.wins++; eco.addXp(50); await eco.save();
      return reply(sock, msg, ctx, `🎱 *BINGO!*\n\nCartela: \`${cartela}\`\n🎯 Sorteado: *${sorteado}*\n\n🏆 *BINGO!* +1000 🪙`);
    }
    return reply(sock, msg, ctx, `🎱 *BINGO*\n\nCartela: \`${cartela}\`\n🎯 Sorteado: *${sorteado}*\n\n💀 Não rolou!`);
  },

  // ============ CAÇA-PALAVRAS ============
  async cacapalavras({ sock, msg, ctx }) {
    const palavra = pick(TRIVIA_BUSCA);
    const grid = [];
    const size = 6;
    const dir = randInt(0,1); // 0=horizontal, 1=vertical
    const padStart = randInt(0, size - palavra.length);
    const fixedRow = randInt(0, size-1);
    for (let i = 0; i < size; i++) {
      const row = [];
      for (let j = 0; j < size; j++) {
        if (dir === 0 && i === fixedRow && j >= padStart && j < padStart + palavra.length) {
          row.push(palavra[j - padStart].toUpperCase());
        } else if (dir === 1 && j === fixedRow && i >= padStart && i < padStart + palavra.length) {
          row.push(palavra[i - padStart].toUpperCase());
        } else {
          row.push(String.fromCharCode(65 + randInt(0,25)));
        }
      }
      grid.push(row.join(' '));
    }
    return reply(sock, msg, ctx,
      `🔍 *CAÇA-PALAVRAS*\n\n\`\`\`\n${grid.join('\n')}\n\`\`\`\n\nAche a palavra escondida!\nDica: tem ${palavra.length} letras\n\n_Apenas visual, prêmio: orgulho 😎_`);
  },
};

// helpers blackjack
function newDeck() {
  const suits = ['♠️','♥️','♦️','♣️'];
  const vals = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const d = [];
  for (const s of suits) for (const v of vals) d.push(v + s);
  return d.sort(() => Math.random() - 0.5);
}
function drawCard(deck) { return deck.pop(); }
function sumHand(hand) {
  let sum = 0, aces = 0;
  for (const c of hand) {
    const v = c.slice(0, c.length-2);
    if (v === 'A') { aces++; sum += 11; }
    else if (['J','Q','K'].includes(v)) sum += 10;
    else sum += parseInt(v);
  }
  while (sum > 21 && aces > 0) { sum -= 10; aces--; }
  return sum;
}
