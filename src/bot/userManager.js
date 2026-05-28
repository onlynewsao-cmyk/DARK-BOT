/**
 * User Manager — sistema centralizado de identificação de usuários
 *
 * Regra: 1 número WhatsApp = 1 usuário ÚNICO no sistema
 *
 * - Quando alguém manda comando no WhatsApp, identifica como o user existente
 *   no dashboard (não cria duplicata)
 * - Quando alguém registra no dashboard, vincula ao número do WhatsApp
 * - Owner é identificado pelo OWNER_NUMBER do .env
 */
const User = require('../database/models/User');
const config = require('../config');

/**
 * Normaliza número (remove tudo que não é dígito, ignora sufixos :XX)
 */
function normalizeNumber(num) {
  if (!num) return '';
  return String(num).split(':')[0].split('@')[0].replace(/\D/g, '');
}

/**
 * Identifica usuário pelo número do WhatsApp.
 * Cria automaticamente se não existir (com role correto).
 * NUNCA cria duplicata.
 */
async function identifyByWhatsApp(whatsappNumber, pushName = '') {
  const number = normalizeNumber(whatsappNumber);
  if (!number) return null;

  const ownerNum = normalizeNumber(config.owner.number);
  const isOwner = number === ownerNum;

  // Busca usuário pelo número WhatsApp (único)
  let user = await User.findOne({ whatsappNumber: number });

  if (!user) {
    // Procura por username 'wa_<numero>' (legado)
    user = await User.findOne({ username: 'wa_' + number });

    if (!user) {
      // Cria novo usuário
      const username = isOwner ? config.owner.username : `wa_${number}`;
      const exists = await User.findOne({ username });
      if (exists) {
        // Username conflita → adiciona sufixo random
        const finalUsername = username + '_' + Math.random().toString(36).slice(2, 6);
        user = await User.create({
          username: finalUsername,
          password: Math.random().toString(36) + Date.now(),
          name: pushName || `User ${number}`,
          whatsappNumber: number,
          role: isOwner ? 'owner' : 'free',
          autoCreated: true,
        });
      } else {
        user = await User.create({
          username,
          password: Math.random().toString(36) + Date.now(),
          name: pushName || `User ${number}`,
          whatsappNumber: number,
          role: isOwner ? 'owner' : 'free',
          autoCreated: true,
        });
      }
    } else {
      // Encontrou pelo username, atualiza whatsappNumber
      user.whatsappNumber = number;
      if (isOwner && user.role !== 'owner') user.role = 'owner';
      if (pushName && !user.name) user.name = pushName;
      await user.save();
    }
  } else {
    // Já existe pelo número — só atualiza nome se vazio
    if (pushName && (!user.name || user.name.startsWith('User '))) {
      user.name = pushName;
      await user.save();
    }
    // Garante role owner para o dono (caso .env tenha mudado)
    if (isOwner && user.role !== 'owner') {
      user.role = 'owner';
      await user.save();
    }
  }

  return user;
}

/**
 * Procura usuário pelo username (login no dashboard) ou número
 */
async function findOrCreate({ username, password, name, whatsappNumber, role = 'free' }) {
  const number = normalizeNumber(whatsappNumber);

  // Se tem número, prioriza por número
  if (number) {
    let user = await User.findOne({ whatsappNumber: number });
    if (user) {
      // Já existe — atualiza senha (caso seja registro)
      if (password) user.password = password;
      if (name) user.name = name;
      if (username && user.username.startsWith('wa_')) user.username = username; // upgrade do username
      await user.save();
      return user;
    }
  }

  // Se não tem número ou não achou, busca por username
  if (username) {
    let user = await User.findOne({ username: username.toLowerCase().trim() });
    if (user) {
      if (password) user.password = password;
      if (name && !user.name) user.name = name;
      if (number && !user.whatsappNumber) user.whatsappNumber = number;
      await user.save();
      return user;
    }
  }

  // Cria novo
  return User.create({
    username: (username || `wa_${number || Date.now()}`).toLowerCase().trim(),
    password: password || (Math.random().toString(36) + Date.now()),
    name: name || `User ${number || ''}`,
    whatsappNumber: number,
    role,
  });
}

/**
 * Mescla duplicatas existentes (mesmo whatsappNumber)
 * Executa no boot
 */
async function deduplicateUsers() {
  try {
    const all = await User.find({ whatsappNumber: { $ne: '', $exists: true } });
    const byNumber = {};
    for (const u of all) {
      const num = normalizeNumber(u.whatsappNumber);
      if (!num) continue;
      if (!byNumber[num]) byNumber[num] = [];
      byNumber[num].push(u);
    }

    let merged = 0;
    for (const [num, users] of Object.entries(byNumber)) {
      if (users.length <= 1) continue;
      // Mantém o mais antigo (createdAt mais antigo) ou o owner
      users.sort((a, b) => {
        if (a.role === 'owner') return -1;
        if (b.role === 'owner') return 1;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
      const keep = users[0];
      const remove = users.slice(1);

      // Acumula dados nos campos do keep
      for (const r of remove) {
        keep.commandsUsed = (keep.commandsUsed || 0) + (r.commandsUsed || 0);
        if (!keep.name && r.name) keep.name = r.name;
        // Se algum era premium, herda
        if (r.role === 'premium' && keep.role === 'free') {
          keep.role = 'premium';
          keep.premiumUntil = r.premiumUntil;
        }
      }
      await keep.save();
      // Deleta duplicatas
      await User.deleteMany({ _id: { $in: remove.map(r => r._id) } });
      merged += remove.length;
    }

    if (merged > 0) console.log(`🔄 Dedup: ${merged} usuários duplicados mesclados`);
    return merged;
  } catch (e) {
    console.error('Dedup error:', e.message);
    return 0;
  }
}

module.exports = { identifyByWhatsApp, findOrCreate, deduplicateUsers, normalizeNumber };
