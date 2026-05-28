/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║   🔓 DARK BOT - VPN DECRYPTER ENGINE v2                  ║
 * ║   Suporta: HTTP Injector (.ehi/.ehic), HA Tunnel (.hat), ║
 * ║   NPV (.npv/4/7/8), DarkTunnel, AnyTunnel, TLS Tunnel,   ║
 * ║   NetMod, OpenVPN, WireGuard, V2Ray, Trojan, SS,         ║
 * ║   BD Net (bdnet://), APNA Lite, WYR VPN, e mais!         ║
 * ╚══════════════════════════════════════════════════════════╝
 */
const path = require('path');

const parsers = {
  // Arquivos tradicionais
  ehi: require('./formats/ehi'),
  ehic: require('./formats/ehi'),
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
  // Novos formatos URI
  bdnet: require('./formats/bdnet'),
  apnalite: require('./formats/apnalite'),
  apna: require('./formats/apnalite'),
  wyrvpn: require('./formats/wyrvpn'),
  wyr: require('./formats/wyrvpn'),
};

/**
 * Detecta formato pelo nome do arquivo + assinatura/conteúdo
 */
function detectFormat(fileName, buffer) {
  const ext = path.extname(fileName).toLowerCase().slice(1);

  // PRIMEIRO: verificar URIs proprietárias no conteúdo (sobrepõe extensão)
  const text = buffer.toString('utf-8').trim();
  if (/^bdnet:\/\//i.test(text)) return 'bdnet';
  if (/^apnalite:\/\//i.test(text) || /^apna:\/\//i.test(text)) return 'apnalite';
  if (/^wyrvpn:\/\//i.test(text) || /^wyr:\/\//i.test(text)) return 'wyrvpn';

  // SEGUNDO: extensão do arquivo
  if (parsers[ext]) return ext;

  // V2Ray/VMess/etc URIs
  if (/^(vmess|vless|trojan|ss|ssh):\/\//i.test(text)) return 'txt';

  // Headers conhecidos
  const head = buffer.slice(0, 64).toString('utf-8').toLowerCase();
  if (head.includes('[interface]') && head.includes('privatekey')) return 'conf';
  if (head.includes('client') && head.includes('remote') && head.includes('proto')) return 'ovpn';

  // HA Tunnel header
  if (head.startsWith('hat')) return 'hat';

  // NPV header
  if (/^npv[4-8]?/i.test(head.slice(0, 4))) return 'npv';

  // EHI tem JSON com "config_name" geralmente
  if (text.includes('config_name') || text.includes('proxy_ip')) return 'ehi';

  return null;
}

/**
 * Decrypta arquivo - retorna objeto padronizado
 */
async function decrypt(fileName, buffer) {
  const format = detectFormat(fileName, buffer);
  if (!format) {
    throw new Error(
      'Formato não reconhecido. Suportados:\n' +
      '• Arquivos: .ehi, .ehic, .hat, .npv4, .npv7, .npv8, .dark, .any, .tls, .nm, .ovpn, .conf, .ssh, .json, .txt\n' +
      '• URIs: bdnet://, apnalite://, wyrvpn://, vmess://, vless://, trojan://, ss://, ssh://'
    );
  }
  const parser = parsers[format];
  if (!parser) throw new Error(`Parser não disponível para .${format}`);

  const result = await parser.parse(buffer, fileName);

  return {
    success: true,
    format: format.toUpperCase(),
    fileName,
    fileSize: buffer.length,
    parsedAt: new Date().toISOString(),
    ...normalizeOutput(result),
  };
}

function normalizeOutput(r) {
  return {
    configName: r.configName || r.name || '',
    configType: r.configType || r.type || '',
    configMode: r.mode || '',
    appName: r.appName || '',
    appVersion: r.appVersion || '',
    note: r.note || r.notes || '',

    server: {
      host: r.host || r.server || r.proxyHost || r.remoteHost || '',
      port: r.port || r.serverPort || r.proxyPort || r.remotePort || '',
      type: r.connectionType || r.protocol || '',
    },

    ssh: r.ssh || (r.sshHost ? {
      host: r.sshHost, port: r.sshPort, user: r.sshUser, pass: r.sshPass,
    } : null),

    proxy: r.proxy || (r.proxyHost ? {
      host: r.proxyHost, port: r.proxyPort,
      type: r.proxyType || 'HTTP',
      user: r.proxyUser || '', pass: r.proxyPass || '',
    } : null),

    sni: r.sni || r.tlsSni || '',
    tlsVersion: r.tlsVersion || '',

    payload: r.payload || '',
    payloadMethod: r.payloadMethod || '',

    vmess: r.vmess || null,
    vless: r.vless || null,
    trojan: r.trojan || null,
    shadowsocks: r.shadowsocks || null,
    wireguard: r.wireguard || null,
    openvpn: r.openvpn || null,

    dns: r.dns || [],

    rawConfig: r.raw || null,
    allFields: r.allFields || r.extras || {},
  };
}

module.exports = { decrypt, detectFormat, supportedFormats: Object.keys(parsers) };
