/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║   🔓 DARK BOT - VPN DECRYPTER ENGINE                     ║
 * ║   Suporta: HTTP Injector, NPV Tunnel, HA Tunnel Plus,    ║
 * ║   DarkTunnel, AnyTunnel, TLS Tunnel, NetMod Channeler,   ║
 * ║   Shadowsocks, V2Ray, Trojan, OpenVPN, WireGuard, etc.   ║
 * ╚══════════════════════════════════════════════════════════╝
 */
const path = require('path');
const fs = require('fs');

// Carrega todos os parsers
const parsers = {
  ehi: require('./formats/ehi'),
  ehic: require('./formats/ehi'),       // mesmo formato
  hat: require('./formats/hat'),
  npv: require('./formats/npv'),
  npv4: require('./formats/npv'),
  npv7: require('./formats/npv'),
  npv8: require('./formats/npv'),
  dark: require('./formats/darktunnel'),
  darkt: require('./formats/darktunnel'),
  any: require('./formats/anytunnel'),
  tls: require('./formats/tlstunnel'),
  conf: require('./formats/wireguard'),
  nm: require('./formats/netmod'),
  nmess: require('./formats/netmod'),
  ovpn: require('./formats/openvpn'),
  ssh: require('./formats/ssh'),
  ssl: require('./formats/ssh'),
  json: require('./formats/json'),
  txt: require('./formats/text'),
};

/**
 * Detecta formato pelo nome do arquivo + assinatura
 */
function detectFormat(fileName, buffer) {
  const ext = path.extname(fileName).toLowerCase().slice(1);
  if (parsers[ext]) return ext;

  // Tenta detectar pela assinatura/conteúdo
  const head = buffer.slice(0, 64).toString('utf-8').toLowerCase();
  if (head.includes('ehi') || head.startsWith('payload')) return 'ehi';
  if (head.includes('[interface]') && head.includes('privatekey')) return 'conf';
  if (head.includes('client') && head.includes('remote')) return 'ovpn';
  if (head.includes('vmess://') || head.includes('vless://') || head.includes('trojan://') || head.includes('ss://')) return 'txt';

  // URI schemes diretos
  const text = buffer.toString('utf-8').trim();
  if (text.startsWith('vmess://') || text.startsWith('vless://') || text.startsWith('trojan://') || text.startsWith('ss://') || text.startsWith('ssh://')) {
    return 'txt';
  }

  return null;
}

/**
 * Decrypta arquivo - retorna objeto padronizado
 */
async function decrypt(fileName, buffer) {
  const format = detectFormat(fileName, buffer);
  if (!format) {
    throw new Error('Formato não reconhecido. Suportados: .ehi, .ehic, .hat, .npv4, .dark, .any, .tls, .conf, .nm, .ovpn, .ssh, .json');
  }
  const parser = parsers[format];
  if (!parser) throw new Error(`Parser não disponível para .${format}`);

  const result = await parser.parse(buffer, fileName);

  // Normaliza saída
  return {
    success: true,
    format: format.toUpperCase(),
    fileName,
    fileSize: buffer.length,
    parsedAt: new Date().toISOString(),
    ...normalizeOutput(result),
  };
}

/**
 * Padroniza campos de saída
 */
function normalizeOutput(r) {
  return {
    // Metadata do config
    configName: r.configName || r.name || '',
    configType: r.configType || r.type || '',
    configMode: r.mode || '',
    appName: r.appName || '',
    appVersion: r.appVersion || '',
    note: r.note || r.notes || '',

    // Servidor principal
    server: {
      host: r.host || r.server || r.proxyHost || r.remoteHost || '',
      port: r.port || r.serverPort || r.proxyPort || r.remotePort || '',
      type: r.connectionType || r.protocol || '',
    },

    // SSH
    ssh: r.ssh || (r.sshHost ? {
      host: r.sshHost, port: r.sshPort, user: r.sshUser, pass: r.sshPass,
    } : null),

    // Proxy
    proxy: r.proxy || (r.proxyHost ? {
      host: r.proxyHost, port: r.proxyPort,
      type: r.proxyType || 'HTTP',
      user: r.proxyUser || '', pass: r.proxyPass || '',
    } : null),

    // SNI / TLS
    sni: r.sni || r.tlsSni || '',
    tlsVersion: r.tlsVersion || '',

    // Payload (HTTP Injector etc)
    payload: r.payload || '',
    payloadMethod: r.payloadMethod || '',

    // V2Ray / VMess / VLess / Trojan
    vmess: r.vmess || null,
    vless: r.vless || null,
    trojan: r.trojan || null,
    shadowsocks: r.shadowsocks || null,

    // WireGuard
    wireguard: r.wireguard || null,

    // OpenVPN
    openvpn: r.openvpn || null,

    // DNS
    dns: r.dns || [],

    // Extras
    rawConfig: r.raw || null,
    allFields: r.allFields || r.extras || {},
  };
}

module.exports = { decrypt, detectFormat, supportedFormats: Object.keys(parsers) };
