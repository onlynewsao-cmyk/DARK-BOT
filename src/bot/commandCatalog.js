/**
 * Catálogo central de TODOS os comandos do bot
 * (usado pelo dashboard pra listar/editar)
 */

const CATALOG = [
  // ===== INFO =====
  { name: 'menu', category: 'info', emoji: '📜', description: 'Mostra todos os comandos', native: true },
  { name: 'ping', category: 'info', emoji: '🏓', description: 'Testa latência do bot', native: true },
  { name: 'dono', category: 'info', emoji: '👑', description: 'Info do dono do bot', native: true },
  { name: 'info', category: 'info', emoji: 'ℹ️', description: 'Informações do bot', native: true },
  { name: 'id', category: 'info', emoji: '🆔', description: 'Seu ID e do chat', native: true },
  { name: 'perfil', category: 'info', emoji: '👤', description: 'Seu perfil', native: true },

  // ===== IA =====
  { name: 'ia', category: 'ia', emoji: '🧠', description: 'Conversa com IA', native: true },
  { name: 'gpt', category: 'ia', emoji: '🧠', description: 'Alias para !ia', native: true },
  { name: 'imagem', category: 'ia', emoji: '🎨', description: 'Gera imagem com IA', native: true },
  { name: 'figura', category: 'ia', emoji: '✨', description: 'Gera sticker com IA', native: true },

  // ===== DOWNLOADS =====
  { name: 'play', category: 'downloads', emoji: '🎵', description: 'Baixa áudio do YouTube', native: true },
  { name: 'video', category: 'downloads', emoji: '🎬', description: 'Baixa vídeo do YouTube', native: true },
  { name: 'tiktok', category: 'downloads', emoji: '🎵', description: 'Baixa vídeo TikTok', native: true },
  { name: 'instagram', category: 'downloads', emoji: '📸', description: 'Baixa post/reels Instagram', native: true },
  { name: 'fb', category: 'downloads', emoji: '📘', description: 'Baixa vídeo Facebook', native: true },
  { name: 'twitter', category: 'downloads', emoji: '🐦', description: 'Baixa do Twitter/X', native: true },
  { name: 'spotify', category: 'downloads', emoji: '🎧', description: 'Baixa música do Spotify', native: true },
  { name: 'soundcloud', category: 'downloads', emoji: '☁️', description: 'Baixa do SoundCloud', native: true },
  { name: 'pinterest', category: 'downloads', emoji: '📌', description: 'Baixa do Pinterest', native: true },

  // ===== STICKERS =====
  { name: 'sticker', category: 'stickers', emoji: '🎨', description: 'Converte foto/vídeo em sticker', native: true },
  { name: 'toimg', category: 'stickers', emoji: '🖼️', description: 'Sticker em imagem', native: true },
  { name: 'attp', category: 'stickers', emoji: '✍️', description: 'Texto animado', native: true },
  { name: 'ttp', category: 'stickers', emoji: '✍️', description: 'Texto em sticker', native: true },

  // ===== GRUPOS =====
  { name: 'ban', category: 'grupos', emoji: '🚫', description: 'Bane usuário', native: true, ownerOrAdmin: true },
  { name: 'kick', category: 'grupos', emoji: '🚫', description: 'Alias para ban', native: true, ownerOrAdmin: true },
  { name: 'promote', category: 'grupos', emoji: '👑', description: 'Promove a admin', native: true, ownerOrAdmin: true },
  { name: 'demote', category: 'grupos', emoji: '⬇️', description: 'Tira admin', native: true, ownerOrAdmin: true },
  { name: 'grupo', category: 'grupos', emoji: '👥', description: 'Info do grupo', native: true },
  { name: 'link', category: 'grupos', emoji: '🔗', description: 'Link do grupo', native: true, ownerOrAdmin: true },
  { name: 'revoke', category: 'grupos', emoji: '🔄', description: 'Reseta link', native: true, ownerOrAdmin: true },
  { name: 'open', category: 'grupos', emoji: '🔓', description: 'Abre grupo', native: true, ownerOrAdmin: true },
  { name: 'close', category: 'grupos', emoji: '🔒', description: 'Fecha grupo', native: true, ownerOrAdmin: true },
  { name: 'todos', category: 'grupos', emoji: '📢', description: 'Marca todos', native: true, ownerOrAdmin: true },
  { name: 'hidetag', category: 'grupos', emoji: '📢', description: 'Marca todos invisível', native: true, ownerOrAdmin: true },
  { name: 'antilink', category: 'grupos', emoji: '🛡️', description: 'Liga/desliga antilink', native: true, ownerOrAdmin: true },
  { name: 'antispam', category: 'grupos', emoji: '🛡️', description: 'Liga/desliga antispam', native: true, ownerOrAdmin: true },
  { name: 'welcome', category: 'grupos', emoji: '👋', description: 'Liga/desliga boas-vindas', native: true, ownerOrAdmin: true },

  // ===== DIVERSÃO =====
  { name: 'dado', category: 'diversao', emoji: '🎲', description: 'Rola um dado', native: true },
  { name: 'moeda', category: 'diversao', emoji: '🪙', description: 'Cara ou coroa', native: true },
  { name: 'piada', category: 'diversao', emoji: '😂', description: 'Conta piada', native: true },
  { name: 'frase', category: 'diversao', emoji: '💭', description: 'Frase motivacional', native: true },
  { name: 'ppt', category: 'diversao', emoji: '🎮', description: 'Pedra/papel/tesoura', native: true },
  { name: 'gay', category: 'diversao', emoji: '🏳️‍🌈', description: '% gay', native: true },
  { name: 'lindo', category: 'diversao', emoji: '😍', description: '% lindo', native: true },
  { name: 'feio', category: 'diversao', emoji: '🥶', description: '% feio', native: true },
  { name: 'burro', category: 'diversao', emoji: '🤡', description: '% burro', native: true },
  { name: 'corno', category: 'diversao', emoji: '🦌', description: '% corno', native: true },
  { name: 'rico', category: 'diversao', emoji: '💰', description: '% rico', native: true },
  { name: 'safado', category: 'diversao', emoji: '😏', description: '% safado', native: true },
  { name: 'doido', category: 'diversao', emoji: '🤪', description: '% doido', native: true },
  { name: 'gostoso', category: 'diversao', emoji: '🥵', description: '% gostoso', native: true },
  { name: 'malucao', category: 'diversao', emoji: '🌀', description: '% maluco', native: true },
  { name: 'casal', category: 'diversao', emoji: '💕', description: 'Casal aleatório', native: true },
  { name: 'ship', category: 'diversao', emoji: '💕', description: 'Ship 2 pessoas', native: true },
  { name: 'roleta', category: 'diversao', emoji: '🎰', description: 'Sorteia alguém', native: true },
  { name: 'fofoca', category: 'diversao', emoji: '🤫', description: 'Fofoca aleatória', native: true },

  // ===== INTERAÇÕES =====
  { name: 'abracar', category: 'interacoes', emoji: '🤗', description: 'Abraça alguém', native: true },
  { name: 'beijar', category: 'interacoes', emoji: '😘', description: 'Beija alguém', native: true },
  { name: 'cafune', category: 'interacoes', emoji: '🥰', description: 'Faz cafuné', native: true },
  { name: 'declarar', category: 'interacoes', emoji: '💌', description: 'Declara amor', native: true },
  { name: 'flertar', category: 'interacoes', emoji: '😏', description: 'Flerta', native: true },
  { name: 'paparico', category: 'interacoes', emoji: '✨', description: 'Paparica', native: true },
  { name: 'tapa', category: 'interacoes', emoji: '👋', description: 'Dá tapa', native: true },
  { name: 'soco', category: 'interacoes', emoji: '🥊', description: 'Dá soco', native: true },
  { name: 'chute', category: 'interacoes', emoji: '🦵', description: 'Dá chute', native: true },
  { name: 'tiro', category: 'interacoes', emoji: '🔫', description: 'Dá tiro', native: true },
  { name: 'facada', category: 'interacoes', emoji: '🔪', description: 'Esfaqueia', native: true },
  { name: 'matar', category: 'interacoes', emoji: '💀', description: 'Mata', native: true },
  { name: 'bater', category: 'interacoes', emoji: '👊', description: 'Bate em alguém', native: true },
  { name: 'morder', category: 'interacoes', emoji: '🦷', description: 'Morde', native: true },
  { name: 'cuspir', category: 'interacoes', emoji: '💦', description: 'Cospe', native: true },
  { name: 'empurrar', category: 'interacoes', emoji: '➡️', description: 'Empurra', native: true },
  { name: 'acordar', category: 'interacoes', emoji: '⏰', description: 'Acorda', native: true },
  { name: 'cuidar', category: 'interacoes', emoji: '👨‍⚕️', description: 'Cuida', native: true },
  { name: 'envenenar', category: 'interacoes', emoji: '☠️', description: 'Envenena', native: true },
  { name: 'mimimi', category: 'interacoes', emoji: '😭', description: 'Faz mimimi', native: true },
  { name: 'fofocar', category: 'interacoes', emoji: '🤫', description: 'Fofoca de alguém', native: true },
  { name: 'bencao', category: 'interacoes', emoji: '🙏', description: 'Abençoa', native: true },
  { name: 'amaldicoar', category: 'interacoes', emoji: '🧙', description: 'Amaldiçoa', native: true },
  { name: 'espancar', category: 'interacoes', emoji: '🥵', description: 'Espanca', native: true },
  { name: 'bullying', category: 'interacoes', emoji: '😈', description: 'Bullying', native: true },

  // ===== FAMÍLIA =====
  { name: 'casar', category: 'familia', emoji: '💍', description: 'Casa com alguém', native: true },
  { name: 'aceitar', category: 'familia', emoji: '✅', description: 'Aceita pedido', native: true },
  { name: 'recusar', category: 'familia', emoji: '❌', description: 'Recusa pedido', native: true },
  { name: 'divorciar', category: 'familia', emoji: '💔', description: 'Divorcia', native: true },
  { name: 'esposa', category: 'familia', emoji: '💍', description: 'Sua esposa(o)', native: true },
  { name: 'adotar', category: 'familia', emoji: '👶', description: 'Adota alguém', native: true },
  { name: 'expulsar', category: 'familia', emoji: '🏃', description: 'Expulsa filho', native: true },
  { name: 'familia', category: 'familia', emoji: '👨‍👩‍👧', description: 'Mostra família', native: true },

  // ===== ECONOMIA =====
  { name: 'saldo', category: 'economia', emoji: '💰', description: 'Ver carteira', native: true },
  { name: 'daily', category: 'economia', emoji: '🎁', description: 'Bônus diário', native: true },
  { name: 'trabalhar', category: 'economia', emoji: '💼', description: 'Trabalha', native: true },
  { name: 'crime', category: 'economia', emoji: '🦹', description: 'Comete crime', native: true },
  { name: 'pedir', category: 'economia', emoji: '🙏', description: 'Pede esmola', native: true },
  { name: 'roubar', category: 'economia', emoji: '🦹', description: 'Rouba alguém', native: true },
  { name: 'depositar', category: 'economia', emoji: '🏦', description: 'Deposita no banco', native: true },
  { name: 'sacar', category: 'economia', emoji: '🏦', description: 'Saca do banco', native: true },
  { name: 'transferir', category: 'economia', emoji: '💸', description: 'Transfere', native: true },
  { name: 'apostar', category: 'economia', emoji: '🎰', description: 'Caça-níquel', native: true },
  { name: 'loja', category: 'economia', emoji: '🏪', description: 'Ver loja', native: true },
  { name: 'comprar', category: 'economia', emoji: '🛒', description: 'Comprar item', native: true },
  { name: 'inventario', category: 'economia', emoji: '🎒', description: 'Seu inventário', native: true },
  { name: 'usar', category: 'economia', emoji: '✨', description: 'Usar item', native: true },
  { name: 'heal', category: 'economia', emoji: '❤️', description: 'Curar HP', native: true },
  { name: 'ranking', category: 'economia', emoji: '🏆', description: 'Ranking', native: true },

  // ===== JOGOS =====
  { name: 'forca', category: 'jogos', emoji: '🎮', description: 'Jogo da forca', native: true },
  { name: 'letra', category: 'jogos', emoji: '🔤', description: 'Adivinha letra (forca)', native: true },
  { name: 'palavra', category: 'jogos', emoji: '📝', description: 'Adivinha palavra (forca)', native: true },
  { name: 'quiz', category: 'jogos', emoji: '🧠', description: 'Quiz de perguntas', native: true },
  { name: 'resp', category: 'jogos', emoji: '✅', description: 'Responde quiz', native: true },
  { name: 'adivinha', category: 'jogos', emoji: '🎯', description: 'Adivinha número', native: true },
  { name: 'chute', category: 'jogos', emoji: '🎯', description: 'Chuta número', native: true },
  { name: 'blackjack', category: 'jogos', emoji: '♠️', description: '21 - Blackjack', native: true },
  { name: 'russa', category: 'jogos', emoji: '🔫', description: 'Roleta russa', native: true },
  { name: 'verdade', category: 'jogos', emoji: '🟢', description: 'Verdade', native: true },
  { name: 'desafio', category: 'jogos', emoji: '🔴', description: 'Desafio', native: true },
  { name: 'vd', category: 'jogos', emoji: '🎲', description: 'Verdade ou desafio', native: true },
  { name: 'bingo', category: 'jogos', emoji: '🎱', description: 'Bingo', native: true },
  { name: 'cacapalavras', category: 'jogos', emoji: '🔍', description: 'Caça-palavras', native: true },
  { name: 'akinator', category: 'jogos', emoji: '🧞', description: 'Akinator', native: true },
  { name: 'desistir', category: 'jogos', emoji: '🛑', description: 'Cancela jogo', native: true },

  // ===== UTILITÁRIOS =====
  { name: 'qrcode', category: 'utils', emoji: '📱', description: 'Gera QR code', native: true },
  { name: 'calc', category: 'utils', emoji: '🧮', description: 'Calculadora', native: true },
  { name: 'translate', category: 'utils', emoji: '🌐', description: 'Tradutor', native: true },
  { name: 'clima', category: 'utils', emoji: '🌤️', description: 'Previsão do tempo', native: true },
  { name: 'encurtar', category: 'utils', emoji: '🔗', description: 'Encurta URL', native: true },

  // ===== PREMIUM =====
  { name: 'vip', category: 'premium', emoji: '⭐', description: 'Info Premium', native: true },
  { name: 'assinar', category: 'premium', emoji: '💎', description: 'Assinar Premium', native: true },
  { name: 'meuplano', category: 'premium', emoji: '📊', description: 'Meu plano', native: true },

  // ===== VPN DECRYPTER =====
  { name: 'decrypt', category: 'vpn', emoji: '🔓', description: 'Decifra arquivo VPN', native: true, premium: true },

  // ===== DONO =====
  { name: 'broadcast', category: 'dono', emoji: '📢', description: 'Broadcast pra todos grupos', native: true, ownerOnly: true },
  { name: 'setpremium', category: 'dono', emoji: '⭐', description: 'Define premium', native: true, ownerOnly: true },
  { name: 'blacklist', category: 'dono', emoji: '🚫', description: 'Bloqueia usuário', native: true, ownerOnly: true },
  { name: 'unblacklist', category: 'dono', emoji: '✅', description: 'Desbloqueia', native: true, ownerOnly: true },
  { name: 'stats', category: 'dono', emoji: '📊', description: 'Estatísticas', native: true, ownerOnly: true },
  { name: 'restart', category: 'dono', emoji: '🔄', description: 'Reinicia bot', native: true, ownerOnly: true },
  { name: 'agendar', category: 'dono', emoji: '📅', description: 'Agendar mensagem', native: true, ownerOnly: true },
  { name: 'backup', category: 'dono', emoji: '💾', description: 'Backup', native: true, ownerOnly: true },

  // ===== TRAPAÇAS DO DONO =====
  { name: 'forjar', category: 'trapacas', emoji: '🎭', description: 'Forja mensagem como outro', native: true, ownerOnly: true },
  { name: 'simular', category: 'trapacas', emoji: '🎭', description: 'Simula comando como outro', native: true, ownerOnly: true },
  { name: 'fakeban', category: 'trapacas', emoji: '👻', description: 'Fake ban', native: true, ownerOnly: true },
  { name: 'fakelog', category: 'trapacas', emoji: '🖥️', description: 'Fake log de sistema', native: true, ownerOnly: true },
  { name: 'forcareacao', category: 'trapacas', emoji: '😈', description: 'Força reação', native: true, ownerOnly: true },
  { name: 'antidelete', category: 'trapacas', emoji: '👁️', description: 'Anti-delete on/off', native: true, ownerOnly: true },
  { name: 'apagadas', category: 'trapacas', emoji: '👻', description: 'Ver msgs apagadas', native: true, ownerOnly: true },
  { name: 'espiao', category: 'trapacas', emoji: '🕵️', description: 'Modo espião', native: true, ownerOnly: true },
  { name: 'grupos', category: 'trapacas', emoji: '📋', description: 'Lista todos os grupos', native: true, ownerOnly: true },
  { name: 'ver', category: 'trapacas', emoji: '🔍', description: 'Ver info de grupo', native: true, ownerOnly: true },
  { name: 'godmode', category: 'trapacas', emoji: '👑', description: 'Modo Deus (economia)', native: true, ownerOnly: true },
  { name: 'winforca', category: 'trapacas', emoji: '🎯', description: 'Trapaceia forca', native: true, ownerOnly: true },
  { name: 'winquiz', category: 'trapacas', emoji: '🎯', description: 'Trapaceia quiz', native: true, ownerOnly: true },
  { name: 'winadivinha', category: 'trapacas', emoji: '🎯', description: 'Trapaceia adivinha', native: true, ownerOnly: true },
  { name: 'send', category: 'trapacas', emoji: '📤', description: 'Envia mensagem privada', native: true, ownerOnly: true },
  { name: 'sendgroup', category: 'trapacas', emoji: '📤', description: 'Envia em grupo', native: true, ownerOnly: true },
  { name: 'eval', category: 'trapacas', emoji: '⚡', description: 'Executa JavaScript', native: true, ownerOnly: true },
  { name: 'shell', category: 'trapacas', emoji: '🐚', description: 'Executa shell', native: true, ownerOnly: true },
  { name: 'dar', category: 'trapacas', emoji: '💸', description: 'Dá coins (cheat)', native: true, ownerOnly: true },
  { name: 'cassar', category: 'trapacas', emoji: '🚫', description: 'Zera patrimônio', native: true, ownerOnly: true },
];

// Categorias e seus metadados
const CATEGORIES = {
  info: { name: '📜 Informações', emoji: '📜', color: '#06b6d4' },
  ia: { name: '🧠 Inteligência Artificial', emoji: '🧠', color: '#b14aed' },
  downloads: { name: '📥 Downloads', emoji: '📥', color: '#00ff9d' },
  stickers: { name: '🎨 Stickers', emoji: '🎨', color: '#ff2e88' },
  grupos: { name: '👥 Grupos', emoji: '👥', color: '#00f0ff' },
  diversao: { name: '🎉 Diversão', emoji: '🎉', color: '#ffd700' },
  interacoes: { name: '💕 Interações', emoji: '💕', color: '#ff69b4' },
  familia: { name: '👨‍👩‍👧 Família', emoji: '👨‍👩‍👧', color: '#ffa500' },
  economia: { name: '💰 Economia', emoji: '💰', color: '#ffd700' },
  jogos: { name: '🎮 Jogos', emoji: '🎮', color: '#9370db' },
  utils: { name: '🛠️ Utilitários', emoji: '🛠️', color: '#87ceeb' },
  premium: { name: '⭐ Premium', emoji: '⭐', color: '#ffd700' },
  vpn: { name: '🔓 VPN Decrypter', emoji: '🔓', color: '#ff4500' },
  dono: { name: '👑 Dono', emoji: '👑', color: '#ffd700' },
  trapacas: { name: '🎭 Trapaças', emoji: '🎭', color: '#ff0040' },
};

function getCategories() {
  return CATEGORIES;
}

function getAll() {
  return CATALOG;
}

function getByName(name) {
  return CATALOG.find(c => c.name === name.toLowerCase());
}

function getByCategory(category) {
  return CATALOG.filter(c => c.category === category);
}

function getCategoryList() {
  const set = new Set(CATALOG.map(c => c.category));
  return Array.from(set);
}

module.exports = { CATALOG, CATEGORIES, getAll, getByName, getByCategory, getCategoryList, getCategories };
