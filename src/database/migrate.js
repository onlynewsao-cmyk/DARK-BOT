/**
 * Migração automática otimizada
 * Não bloqueia o boot do servidor
 */
const mongoose = require('mongoose');

async function migrate() {
  if (mongoose.connection.readyState !== 1) return;
  const db = mongoose.connection.db;

  try {
    const collections = await db.listCollections().toArray();
    const sessionsCol = db.collection('sessions');

    // Verifica se tem o índice problemático
    const indexes = await sessionsCol.indexes().catch(() => []);
    const hasFileNameIndex = indexes.find(i => i.name === 'fileName_1');

    if (!hasFileNameIndex) {
      console.log('✅ Sessions já está limpa, sem migração necessária');
      return;
    }

    console.log('🔧 Detectado conflito de sessions, corrigindo...');

    // ESTRATÉGIA RÁPIDA:
    // 1. Renomear sessions -> sessions_old_baileys (movimento rápido)
    // 2. Copiar pra baileys_sessions só os recentes (assíncrono em background)
    // 3. connect-mongo criará uma sessions nova limpa

    try {
      // Verifica se sessions_old já existe
      const oldExists = collections.find(c => c.name === 'sessions_old_baileys');
      if (oldExists) {
        // Já foi migrado antes, só dropa
        console.log('🗑️ sessions_old_baileys já existe, dropando sessions atual');
        await sessionsCol.drop();
      } else {
        // Renomeia
        await db.renameCollection('sessions', 'sessions_old_baileys');
        console.log('✅ sessions renomeada para sessions_old_baileys');
      }

      // Em background, copia os dados pra baileys_sessions (não bloqueia)
      setImmediate(async () => {
        try {
          const oldCol = db.collection('sessions_old_baileys');
          const newCol = db.collection('baileys_sessions');
          const cursor = oldCol.find({ fileName: { $exists: true, $ne: null } });
          let count = 0;
          while (await cursor.hasNext()) {
            const doc = await cursor.next();
            const { _id, ...rest } = doc;
            await newCol.updateOne(
              { fileName: rest.fileName },
              { $set: rest },
              { upsert: true }
            ).catch(()=>{});
            count++;
          }
          console.log(`🔄 Migração background: ${count} docs Baileys copiados`);
        } catch (e) {
          console.error('Migração background falhou:', e.message);
        }
      });
    } catch (e) {
      // Se renomear falhar, tenta dropar o índice ao menos
      try {
        await sessionsCol.dropIndex('fileName_1');
        console.log('✅ Índice fileName_1 removido (fallback)');
      } catch (e2) {
        console.error('Não conseguiu nem dropar índice:', e2.message);
      }
    }

    console.log('✅ Migração principal concluída');
  } catch (err) {
    console.error('⚠️ Erro na migração (não fatal):', err.message);
  }
}

module.exports = { migrate };
