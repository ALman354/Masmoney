const AUTH_TOKEN_KEY = 'masmoney_token';
const AUTH_USER_KEY = 'masmoney_user';
const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '';
let mode = 'login';

if (localStorage.getItem(AUTH_TOKEN_KEY)) window.location.href = 'dashboard.html';

const form = document.getElementById('loginForm');
const errorBox = document.getElementById('loginError');
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const submitButton = document.getElementById('submitButton');
const formModeLabel = document.getElementById('formModeLabel');
const formTitle = document.getElementById('formTitle');
const formDescription = document.getElementById('formDescription');
const registerOnlyFields = document.querySelectorAll('.register-only');

function setMode(nextMode) {
  mode = nextMode;
  errorBox.classList.remove('show');
  errorBox.textContent = '';
  const isRegister = mode === 'register';
  loginTab.classList.toggle('active', !isRegister);
  registerTab.classList.toggle('active', isRegister);
  registerOnlyFields.forEach((el) => el.classList.toggle('show', isRegister));
  document.getElementById('nama').required = isRegister;
  formModeLabel.textContent = isRegister ? 'Daftar Akun' : 'Masuk Akun';
  formTitle.textContent = isRegister ? 'Buat akun baru' : 'Selamat datang kembali';
  formDescription.textContent = isRegister ? 'Akun baru akan memiliki data transaksi sendiri.' : 'Masuk untuk membuka dashboard MasMoney.';
  submitButton.textContent = isRegister ? 'Buat Akun' : 'Masuk Dashboard';
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.add('show');
}

async function submitAuth(payload) {
  const endpoint = mode === 'register' ? '/auth/register' : '/auth/login';
  const response = await fetch(apiBase + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Autentikasi gagal.');
  return result;
}

loginTab.addEventListener('click', () => setMode('login'));
registerTab.addEventListener('click', () => setMode('register'));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  submitButton.textContent = mode === 'register' ? 'Membuat akun...' : 'Masuk...';
  try {
    const payload = { nama: document.getElementById('nama').value.trim(), username: document.getElementById('username').value.trim(), password: document.getElementById('password').value };
    const result = await submitAuth(payload);
    localStorage.setItem(AUTH_TOKEN_KEY, result.token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(result.user));
    window.location.href = 'dashboard.html';
  } catch (err) {
    showError(err.message);
    submitButton.disabled = false;
    submitButton.textContent = mode === 'register' ? 'Buat Akun' : 'Masuk Dashboard';
  }
});

setMode('login');
