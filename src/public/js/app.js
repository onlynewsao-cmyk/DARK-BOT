// ===== DARK BOT — Frontend Global =====
console.log('%c⚡ DARK BOT ⚡', 'background:linear-gradient(135deg,#b14aed,#00f0ff);color:white;padding:8px 16px;border-radius:6px;font-weight:900;font-size:14px;letter-spacing:2px');

// ===== Toast notifications =====
window.toast = function(message, type = 'info', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warn: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span style="font-size:1.25rem">${icons[type]}</span><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'slideIn 0.3s reverse';
    setTimeout(() => el.remove(), 300);
  }, duration);
};

// ===== Mobile sidebar =====
document.addEventListener('DOMContentLoaded', () => {
  // Create menu toggle if sidebar exists
  if (document.querySelector('.sidebar')) {
    const toggle = document.createElement('button');
    toggle.className = 'menu-toggle';
    toggle.innerHTML = '☰';
    toggle.onclick = () => document.querySelector('.sidebar').classList.toggle('open');
    document.body.appendChild(toggle);
  }
});

// ===== Confirm helper =====
window.confirmAction = function(message) {
  return new Promise(resolve => resolve(confirm(message)));
};
