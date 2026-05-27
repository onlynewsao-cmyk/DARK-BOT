const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore,
  delay,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const config = require('../config');

const AUTH_FOLDER = path.join(__dirname, '..', '..', 'data', 'auth');
if (!fs.existsSync(AUTH_FOLDER)) fs.mkdirSync(AUTH_FOLDER, { recursive: true });

class WhatsAppBot {
  constructor() {
    this.io = null;
    this.sock = null;
    this.qrCode = null;
    this.qrRaw = null;
    this.pairingCode = null;
    this.connectionStatus = 'disconnected';
    this.connectionMode = 'qr';
    this.requestedNumber = null;
    this.user = null;
    this.lastError = null;
    this.startedAt = null;
    this.messageCount = 0;
    this.commandCount = 0;
    this.starting = false;
  }

  setIO(io) {
    this.io = io;
  }

  emit(event, data) {
    try {
      if (this.io) this.io.emit(event, data);
    } catch (e) {
      console.error('Emit error:', e.message);
    }
  }

  setStatus(status, extra = {}) {
    this.connectionStatus = status;
    const payload = { status, ...extra };
    console.log(`📡 [BOT STATUS] ${status}`, extra.pairingCode ? `pair=${extra.pairingCode}` : '');
    this.emit('bot:status', payload);
  }

  log(level, message) {
    console.log(`[BOT] ${message}`);
    this.emit('bot:log', { level, message, time: new Date().toISOString() });
  }

  async start({ mode = 'qr', phoneNumber = null } = {}) {
    if (this.starting) {
      this.log('warn', 'Já está iniciando, aguarde...');
      return;
    }
    this.starting = true;
    this.connectionMode = mode;
    this.requestedNumber = phoneNumber;
    this.qrCode = null;
    this.qrRaw = null;
    this.pairingCode = null;
    this.lastError = null;

    try {
      // Encerra socket anterior
      if (this.sock) {
        try { this.sock.ev.removeAllListeners(); } catch(e){}
        try { this.sock.end(); } catch (e) {}
        this.sock = null;
        await delay(500);
      }

      // Se vai usar pair code, REMOVE credenciais antigas para forçar novo pareamento
      if (mode === 'pair') {
        try {
          fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
          fs.mkdirSync(AUTH_FOLDER, { recursive: true });
          this.log('info', 'Sessão anterior limpa para novo pair code');
        } catch (e) {}
      }

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
      const { version } = await fetchLatestBaileysVersion();
      const logger = pino({ level: 'silent' });

      this.sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: mode === 'pair' ? Browsers.ubuntu('Chrome') : Browsers.macOS('Safari'),
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
      });

      this.setStatus('connecting');

      this.sock.ev.on('creds.update', saveCreds);

      // PAIR CODE: aguarda socket pronto e solicita
      if (mode === 'pair' && phoneNumber && !this.sock.authState.creds.registered) {
        await delay(3000); // aguarda socket inicializar
        try {
          const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
          if (cleanNumber.length < 10) throw new Error('Número inválido (mín. 10 dígitos com DDI)');
          this.log('info', `Solicitando pair code para ${cleanNumber}...`);
          const code = await this.sock.requestPairingCode(cleanNumber);
          this.pairingCode = code?.match(/.{1,4}/g)?.join('-') || code;
          this.setStatus('pairing', {
            pairingCode: this.pairingCode,
            phoneNumber: cleanNumber,
          });
          this.log('success', `🔐 Pair Code: ${this.pairingCode}`);
        } catch (err) {
          console.error('❌ Erro pair code:', err);
          this.lastError = err.message;
          this.log('error', `Falha pair code: ${err.message}`);
          this.emit('bot:error', { message: err.message });
        }
      }

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && mode === 'qr') {
          try {
            this.qrRaw = qr;
            this.qrCode = await QRCode.toDataURL(qr, {
              width: 400,
              margin: 2,
              color: { dark: '#000000', light: '#FFFFFF' },
            });
            this.setStatus('qr', { qr: this.qrCode });
            this.log('info', '📱 QR Code gerado — escaneie pelo WhatsApp');
          } catch (e) {
            console.error('Erro QR:', e);
          }
        }

        if (connection === 'open') {
          this.qrCode = null;
          this.qrRaw = null;
          this.pairingCode = null;
          this.user = this.sock.user;
          this.startedAt = new Date();
          this.setStatus('connected', { user: this.sock.user });
          this.log('success', `✅ Conectado como ${this.sock.user?.id}`);
        }

        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          const reason = lastDisconnect?.error?.message || 'desconhecido';
          const shouldReconnect = code !== DisconnectReason.loggedOut && code !== 401;

          this.log('warn', `Conexão fechada (${code}): ${reason}`);
          this.setStatus('disconnected', { reason: code, message: reason });

          if (code === DisconnectReason.loggedOut || code === 401) {
            try {
              fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
              fs.mkdirSync(AUTH_FOLDER, { recursive: true });
              this.log('warn', 'Sessão expirada/deslogada - credenciais removidas');
            } catch (e) {}
          } else if (shouldReconnect && code !== DisconnectReason.restartRequired) {
            this.log('info', 'Reconectando em 5s...');
            setTimeout(() => {
              this.starting = false;
              this.start({ mode: 'qr' }).catch(e => console.error(e));
            }, 5000);
          } else if (code === DisconnectReason.restartRequired) {
            this.log('info', 'Restart necessário, reconectando...');
            setTimeout(() => {
              this.starting = false;
              this.start({ mode: 'qr' }).catch(e => console.error(e));
            }, 2000);
          }
        }
      });

      // Mensagens
      this.sock.ev.on('messages.upsert', async (m) => {
        try {
          const msg = m.messages?.[0];
          if (!msg || !msg.message) return;
          this.messageCount++;
          if (msg.key.fromMe) return;
          const commandHandler = require('./commandHandler');
          const handled = await commandHandler.handle(this.sock, msg);
          if (handled) this.commandCount++;
        } catch (err) {
          console.error('Erro msg:', err);
        }
      });

      // Eventos de grupo (boas-vindas)
      this.sock.ev.on('group-participants.update', async (event) => {
        try {
          const groupEvents = require('./groupEvents');
          await groupEvents.handle(this.sock, event);
        } catch (e) {
          console.error('Erro group event:', e);
        }
      });

      this.starting = false;
    } catch (err) {
      this.starting = false;
      console.error('❌ Erro no start:', err);
      this.lastError = err.message;
      this.setStatus('disconnected', { error: err.message });
      this.emit('bot:error', { message: err.message });
      throw err;
    }
  }

  async logout() {
    try {
      if (this.sock) await this.sock.logout();
    } catch (e) {}
    try {
      fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
      fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    } catch (e) {}
    this.sock = null;
    this.user = null;
    this.qrCode = null;
    this.pairingCode = null;
    this.setStatus('disconnected');
    this.log('info', 'Bot desconectado e sessão limpa');
  }

  getStatus() {
    return {
      status: this.connectionStatus,
      mode: this.connectionMode,
      qr: this.qrCode,
      pairingCode: this.pairingCode,
      user: this.user,
      startedAt: this.startedAt,
      messageCount: this.messageCount,
      commandCount: this.commandCount,
      lastError: this.lastError,
    };
  }
}

let instance = null;
function getBot(io) {
  if (!instance) instance = new WhatsAppBot();
  if (io) instance.setIO(io);
  return instance;
}

module.exports = { getBot, WhatsAppBot };
