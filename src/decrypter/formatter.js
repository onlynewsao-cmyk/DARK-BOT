/**
 * Formata o resultado do decrypter para WhatsApp e Dashboard
 */
function formatForWhatsApp(r, config) {
  let text = `╭━━━━━━━━━━━━━━━━━━━━━━╮
┃  🔓 *VPN DECRYPTER* 🔓
┃  ⚡ ${config.bot.name}
╰━━━━━━━━━━━━━━━━━━━━━━╯

╭─〔 📄 *ARQUIVO* 〕
│ 📛 ${r.fileName}
│ 🏷️ Formato: *${r.format}*
│ 📦 Tamanho: ${(r.fileSize/1024).toFixed(1)} KB
│ 🤖 App: ${r.appName || '—'}
╰─────────────────────`;

  if (r.configName || r.configType || r.mode) {
    text += `\n\n╭─〔 🎯 *CONFIG* 〕`;
    if (r.configName) text += `\n│ 📝 Nome: ${r.configName}`;
    if (r.configType) text += `\n│ 🔧 Tipo: ${r.configType}`;
    if (r.configMode || r.mode) text += `\n│ ⚙️ Modo: ${r.configMode || r.mode}`;
    if (r.note) text += `\n│ 📌 Nota: ${r.note}`;
    text += `\n╰─────────────────────`;
  }

  // SERVIDOR PRINCIPAL
  if (r.server?.host || r.server?.port) {
    text += `\n\n╭─〔 🌐 *SERVIDOR* 〕
│ 🖥️ Host: \`${r.server.host || '—'}\`
│ 🔌 Porta: \`${r.server.port || '—'}\``;
    if (r.server.type) text += `\n│ 📡 Tipo: ${r.server.type}`;
    text += `\n╰─────────────────────`;
  }

  // SSH
  if (r.ssh && (r.ssh.host || r.ssh.user || r.ssh.pass)) {
    text += `\n\n╭─〔 🔐 *SSH* 〕
│ 🖥️ Host: \`${r.ssh.host || '—'}\`
│ 🔌 Porta: \`${r.ssh.port || '22'}\`
│ 👤 User: \`${r.ssh.user || '—'}\`
│ 🔑 Pass: \`${r.ssh.pass || '—'}\`
╰─────────────────────`;
  }

  // PROXY
  if (r.proxy && (r.proxy.host || r.proxy.port)) {
    text += `\n\n╭─〔 🛡️ *PROXY* 〕
│ 🖥️ Host: \`${r.proxy.host || '—'}\`
│ 🔌 Porta: \`${r.proxy.port || '—'}\`
│ 📡 Tipo: ${r.proxy.type || 'HTTP'}`;
    if (r.proxy.user) text += `\n│ 👤 User: \`${r.proxy.user}\``;
    if (r.proxy.pass) text += `\n│ 🔑 Pass: \`${r.proxy.pass}\``;
    text += `\n╰─────────────────────`;
  }

  // SNI
  if (r.sni) {
    text += `\n\n╭─〔 🔒 *SNI / TLS* 〕
│ 🌐 SNI: \`${r.sni}\``;
    if (r.tlsVersion) text += `\n│ 🔐 Versão: ${r.tlsVersion}`;
    text += `\n╰─────────────────────`;
  }

  // PAYLOAD
  if (r.payload) {
    const payloadStr = String(r.payload).length > 800
      ? String(r.payload).slice(0, 800) + '...'
      : String(r.payload);
    text += `\n\n╭─〔 📡 *PAYLOAD* 〕
│ Método: ${r.payloadMethod || 'CONNECT'}
╰─────────────────────
\`\`\`
${payloadStr}
\`\`\``;
  }

  // VMess
  if (r.vmess) {
    text += `\n\n╭─〔 🔮 *VMESS* 〕
│ 🆔 UUID: \`${r.vmess.uuid || '—'}\`
│ 🔢 AlterId: ${r.vmess.alterId ?? '—'}
│ 🔐 Security: ${r.vmess.security || '—'}
│ 🌐 Network: ${r.vmess.network || '—'}
│ 🔒 TLS: ${r.vmess.tls || '—'}`;
    if (r.vmess.path) text += `\n│ 📂 Path: ${r.vmess.path}`;
    if (r.vmess.host) text += `\n│ 🌍 Host: ${r.vmess.host}`;
    text += `\n╰─────────────────────`;
  }

  // VLess
  if (r.vless) {
    text += `\n\n╭─〔 🔮 *VLESS* 〕
│ 🆔 UUID: \`${r.vless.uuid}\`
│ 🔐 Encryption: ${r.vless.encryption}
│ 🔒 Security: ${r.vless.security}
│ 🌐 Type: ${r.vless.type}`;
    if (r.vless.flow) text += `\n│ 💨 Flow: ${r.vless.flow}`;
    text += `\n╰─────────────────────`;
  }

  // Trojan
  if (r.trojan) {
    text += `\n\n╭─〔 🐎 *TROJAN* 〕
│ 🔑 Senha: \`${r.trojan.password}\`
│ 🌐 SNI: ${r.trojan.sni}
│ 📡 Tipo: ${r.trojan.type}
╰─────────────────────`;
  }

  // Shadowsocks
  if (r.shadowsocks) {
    text += `\n\n╭─〔 🕶️ *SHADOWSOCKS* 〕
│ 🔐 Método: ${r.shadowsocks.method}
│ 🔑 Senha: \`${r.shadowsocks.password}\`
╰─────────────────────`;
  }

  // WireGuard
  if (r.wireguard) {
    text += `\n\n╭─〔 🛡️ *WIREGUARD* 〕
│ 🔑 PrivKey: \`${(r.wireguard.privateKey || '').slice(0, 30)}...\`
│ 🔓 PubKey: \`${(r.wireguard.publicKey || '').slice(0, 30)}...\`
│ 📍 Address: ${r.wireguard.address}
│ 🌐 Endpoint: ${r.wireguard.endpoint}
│ ✅ AllowedIPs: ${r.wireguard.allowedIPs}
│ 🌍 DNS: ${r.wireguard.dns}
╰─────────────────────`;
  }

  // OpenVPN
  if (r.openvpn) {
    text += `\n\n╭─〔 🔓 *OPENVPN* 〕
│ 📡 Proto: ${r.openvpn.proto}
│ 🌐 Remote: ${r.openvpn.remote}
│ 🔐 Cipher: ${r.openvpn.cipher}
│ 🔑 Auth: ${r.openvpn.auth}
│ 🔒 TLS Auth: ${r.openvpn.tlsAuth ? '✅' : '❌'}
│ 👤 Auth User/Pass: ${r.openvpn.authUserPass ? '✅' : '❌'}
╰─────────────────────`;
  }

  // DNS
  if (r.dns && r.dns.length) {
    text += `\n\n╭─〔 🌍 *DNS* 〕`;
    r.dns.forEach(d => text += `\n│ ${d}`);
    text += `\n╰─────────────────────`;
  }

  text += `\n\n🔓 _Decrypted by ${config.bot.name}_\n👑 _${config.owner.name}_`;
  return text;
}

module.exports = { formatForWhatsApp };
