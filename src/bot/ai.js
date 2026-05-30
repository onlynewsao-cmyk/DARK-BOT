/**
 * Integração com IA - Groq (grátis, super rápida) e Gemini (fallback)
 * Groq: https://console.groq.com - chave grátis
 * Gemini: https://aistudio.google.com - chave grátis
 */
const mediaHandler = require('./mediaHandler');
const config = require('../config');

async function chat(prompt, context = '') {
  // 1️⃣ Tenta Groq (Llama 3.1 - super rápido)
  if (process.env.GROQ_API_KEY) {
    try {
      const data = await fetchPost('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: context || `Você é ${config.bot.name}, um bot WhatsApp criado por ${config.owner.name}. Responda de forma curta, amigável e use emojis.` },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }, { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` });
      return data.choices?.[0]?.message?.content || 'Sem resposta';
    } catch (e) { console.warn('Groq falhou:', e.message); }
  }

  // 2️⃣ Fallback: Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const data = await fetchPost(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{ parts: [{ text: `${context || `Você é ${config.bot.name}, um bot WhatsApp criado por ${config.owner.name}.`}\n\nUsuário: ${prompt}` }] }],
        }
      );
      return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta';
    } catch (e) { console.warn('Gemini falhou:', e.message); }
  }

  // 3️⃣ Fallback final: API pública
  try {
    const r = await mediaHandler.fetchJson(`https://api.popcat.xyz/chatbot?msg=${encodeURIComponent(prompt)}&owner=${config.owner.name}&botname=${config.bot.name}`);
    return r?.response || '🤖 Desculpe, IA temporariamente indisponível. Configure GROQ_API_KEY ou GEMINI_API_KEY.';
  } catch (e) {
    return '🤖 IA não disponível. Configure GROQ_API_KEY no .env (grátis em console.groq.com)';
  }
}

async function generateImage(prompt) {
  // API gratuita de geração de imagem
  try {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true&enhance=true`;
    const buf = await mediaHandler.fetchBuffer(url);
    return buf;
  } catch (e) {
    throw new Error('Geração de imagem falhou: ' + e.message);
  }
}

function fetchPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? require('https') : require('http');
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = lib.request({
      hostname: u.hostname, path: u.pathname + u.search, port: u.port || (url.startsWith('https') ? 443 : 80),
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
      timeout: 60000,
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          const txt = Buffer.concat(chunks).toString('utf-8');
          if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode + ': ' + txt));
          resolve(JSON.parse(txt));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data); req.end();
  });
}

module.exports = { chat, generateImage };
