// public/js/login.js
// Handles login form submission and session check

const BASE = '';

async function checkAuth() {
  try {
    const r = await fetch(`${BASE}/api/auth`);
    const d = await r.json();
    if (d.authenticated) window.location.replace('/admin.html');
  } catch {}
}

function showAlert(msg, type = 'error') {
  const el = document.getElementById('login-alert');
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function setLoading(on) {
  const btn = document.getElementById('login-btn');
  const txt = btn.querySelector('.btn-text');
  const spin = btn.querySelector('.btn-spinner');
  btn.disabled = on;
  txt.classList.toggle('hidden', on);
  spin.classList.toggle('hidden', !on);
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();

  // Password toggle
  document.getElementById('toggle-pw')?.addEventListener('click', () => {
    const inp = document.getElementById('password-input');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  // Login form
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('password-input').value;
    setLoading(true);
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ password }),
      });
      const d = await r.json();
      if (r.ok && d.ok) {
        window.location.replace('/admin.html');
      } else {
        showAlert(d.error || 'Login failed');
        setLoading(false);
      }
    } catch {
      showAlert('Cannot reach server — check connection');
      setLoading(false);
    }
  });
});
