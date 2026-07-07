const AUTH_KEY = 'masmoney_auth';
const DEMO_USER = 'admin';
const DEMO_PASS = 'admin123';

if (localStorage.getItem(AUTH_KEY) === 'true') {
  window.location.href = 'dashboard.html';
}

const form = document.getElementById('loginForm');
const errorBox = document.getElementById('loginError');

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (username === DEMO_USER && password === DEMO_PASS) {
    localStorage.setItem(AUTH_KEY, 'true');
    localStorage.setItem('masmoney_user', username);
    window.location.href = 'dashboard.html';
    return;
  }

  errorBox.textContent = 'Username atau password salah. Gunakan admin / admin123.';
  errorBox.classList.add('show');
});
