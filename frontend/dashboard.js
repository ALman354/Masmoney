const AUTH_TOKEN_KEY = 'masmoney_token';
const AUTH_USER_KEY = 'masmoney_user';
const token = localStorage.getItem(AUTH_TOKEN_KEY);

if (!token) window.location.href = '/';

const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '';
const api = apiBase + '/transaksi';
const financeApi = apiBase + '/finance';
let financeChart;
let recapChart;

function getAuthHeaders(extra = {}) {
  return { ...extra, Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY) || ''}` };
}

function handleUnauthorized(response) {
  if (response.status === 401) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    window.location.href = '/';
    return true;
  }
  return false;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

function setLoading(active) {
  document.getElementById('loadingOverlay')?.classList.toggle('show', active);
}

function buildQuery(params) {
  const parts = [];
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  });
  return parts.length ? `?${parts.join('&')}` : '';
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, headers: getAuthHeaders(options.headers || {}) });
  if (handleUnauthorized(response)) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request gagal');
  return data;
}

async function fetchTransactions(params = {}) {
  return await fetchJson(api + buildQuery(params)) || [];
}

function getTableFilterValues() {
  return {
    startDate: document.getElementById('startDateTable').value || '',
    endDate: document.getElementById('endDateTable').value || '',
    limit: document.getElementById('limitRecords').value || '',
    search: document.getElementById('searchRecords')?.value || '',
    kategori: document.getElementById('categoryFilter')?.value || '',
    tipe: document.getElementById('typeFilter')?.value || ''
  };
}

function getDailyFilterValues() {
  return { startDate: document.getElementById('startDateDaily').value || '', endDate: document.getElementById('endDateDaily').value || '' };
}

function getMonthlyFilterValues() {
  return { monthFrom: document.getElementById('monthFrom').value || '', monthTo: document.getElementById('monthTo').value || '' };
}

function monthRangeToDates(fromMonth, toMonth) {
  if (!fromMonth && !toMonth) return {};
  const start = fromMonth ? new Date(`${fromMonth}-01`) : null;
  const end = toMonth ? new Date(new Date(`${toMonth}-01`).getFullYear(), new Date(`${toMonth}-01`).getMonth() + 1, 0) : null;
  return {
    startDate: start ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}` : '',
    endDate: end ? `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}` : ''
  };
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatInputDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function rupiah(value) {
  return 'Rp ' + Number(value || 0).toLocaleString('id-ID');
}

function renderTable(data) {
  let html = '';
  let pemasukan = 0;
  let pengeluaran = 0;
  data.forEach(item => {
    const tipeClass = item.tipe === 'Pemasukan' ? 'badge-income' : 'badge-expense';
    html += `<tr><td>${formatDate(item.created_at)}</td><td>${item.kategori || ''}</td><td>${item.keterangan || ''}</td><td><span class="badge ${tipeClass}">${item.tipe}</span></td><td>${rupiah(item.jumlah)}</td><td><div class="action-group"><button onclick='editData(${JSON.stringify(item)})' class="edit">Edit</button><button onclick="hapusData(${item.id})" class="hapus">Hapus</button></div></td></tr>`;
    if (item.tipe === 'Pemasukan') pemasukan += Number(item.jumlah); else pengeluaran += Number(item.jumlah);
  });
  const saldoText = rupiah(pemasukan - pengeluaran);
  document.getElementById('transaksiData').innerHTML = html || '<tr><td colspan="6" class="empty-row">Belum ada transaksi pada filter ini.</td></tr>';
  document.getElementById('masuk').innerHTML = rupiah(pemasukan);
  document.getElementById('keluar').innerHTML = rupiah(pengeluaran);
  document.getElementById('saldo').innerHTML = saldoText;
  document.getElementById('saldoCard').innerHTML = saldoText;
  document.getElementById('jumlahTransaksi').innerHTML = data.length;
}

function renderFinanceChart(dataItems) {
  const dailyTotals = {};
  dataItems.forEach((item) => {
    const day = item.created_at ? item.created_at.substring(0, 10) : '';
    if (!day) return;
    dailyTotals[day] = (dailyTotals[day] || 0) + (item.tipe === 'Pengeluaran' ? -Number(item.jumlah) : Number(item.jumlah));
  });
  const labels = Object.keys(dailyTotals).sort();
  const values = labels.map((label) => dailyTotals[label]);
  const ctx = document.getElementById('financeChart').getContext('2d');
  if (financeChart) { financeChart.data.labels = labels; financeChart.data.datasets[0].data = values; financeChart.update(); return; }
  financeChart = new Chart(ctx, { type: 'line', data: { labels, datasets: [{ label: 'Saldo Harian', data: values, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.14)', fill: true, tension: 0.4, borderWidth: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#344054' } }, title: { display: true, text: 'Grafik Harian', color: '#344054', font: { size: 16 } } }, scales: { x: { grid: { display: false }, ticks: { color: '#667085' } }, y: { grid: { color: '#e4e7ec' }, ticks: { color: '#667085' } } } } });
}

function renderRecapChart(dataItems, selectedMonth) {
  const totalsPerMonth = {};
  dataItems.forEach((item) => {
    const month = item.created_at ? item.created_at.substring(0, 7) : '';
    if (!month) return;
    if (!totalsPerMonth[month]) totalsPerMonth[month] = { pemasukan: 0, pengeluaran: 0 };
    if (item.tipe === 'Pengeluaran') totalsPerMonth[month].pengeluaran += Number(item.jumlah); else totalsPerMonth[month].pemasukan += Number(item.jumlah);
  });
  const labels = Object.keys(totalsPerMonth).sort();
  const pemasukanValues = labels.map((label) => totalsPerMonth[label].pemasukan);
  const pengeluaranValues = labels.map((label) => totalsPerMonth[label].pengeluaran);
  const displayMonth = selectedMonth || labels[labels.length - 1] || '-';
  const recapForMonth = totalsPerMonth[displayMonth] || { pemasukan: 0, pengeluaran: 0 };
  document.getElementById('rekapBulanDisplay').innerText = displayMonth;
  document.getElementById('rekapMasuk').innerText = rupiah(recapForMonth.pemasukan);
  document.getElementById('rekapKeluar').innerText = rupiah(recapForMonth.pengeluaran);
  const ctx = document.getElementById('recapChart').getContext('2d');
  if (recapChart) { recapChart.data.labels = labels; recapChart.data.datasets[0].data = pemasukanValues; recapChart.data.datasets[1].data = pengeluaranValues; recapChart.update(); return; }
  recapChart = new Chart(ctx, { type: 'line', data: { labels, datasets: [{ label: 'Uang Masuk', data: pemasukanValues, borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.14)', fill: true, tension: 0.4, borderWidth: 3 }, { label: 'Uang Keluar', data: pengeluaranValues, borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.12)', fill: true, tension: 0.4, borderWidth: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#344054' } }, title: { display: true, text: 'Grafik Bulanan', color: '#344054', font: { size: 16 } } }, scales: { x: { ticks: { color: '#667085' }, grid: { color: '#e4e7ec' } }, y: { ticks: { color: '#667085' }, grid: { color: '#e4e7ec' } } } } });
}

async function loadTableData(startDate = '', endDate = '', limit = '', search = '', kategori = '', tipe = '') {
  renderTable(await fetchTransactions({ start_date: startDate, end_date: endDate, limit, search, kategori, tipe }));
}

async function loadDailyChart(startDate = '', endDate = '') {
  renderFinanceChart(await fetchTransactions({ start_date: startDate, end_date: endDate }));
}

async function loadMonthlyChart(monthFrom = '', monthTo = '') {
  const { startDate, endDate } = monthRangeToDates(monthFrom, monthTo);
  renderRecapChart(await fetchTransactions({ start_date: startDate, end_date: endDate }), monthFrom || monthTo);
}

function applyDailyFilter() { const { startDate, endDate } = getDailyFilterValues(); loadDailyChart(startDate, endDate); }
function resetDailyFilter() { document.getElementById('startDateDaily').value = ''; document.getElementById('endDateDaily').value = ''; loadDailyChart(); }
function applyMonthlyFilter() { const { monthFrom, monthTo } = getMonthlyFilterValues(); loadMonthlyChart(monthFrom, monthTo); refreshInsights(); loadBudgets(); }
function resetMonthlyFilter() { document.getElementById('monthFrom').value = ''; document.getElementById('monthTo').value = ''; loadMonthlyChart(); refreshInsights(); }
function applyTableFilter() { const v = getTableFilterValues(); loadTableData(v.startDate, v.endDate, v.limit, v.search, v.kategori, v.tipe); }
function resetTableFilter() { ['startDateTable','endDateTable','limitRecords','searchRecords','categoryFilter','typeFilter'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); loadTableData(); }

function clearForm() { ['kategori','keterangan','tanggal','jumlah'].forEach(id => document.getElementById(id).value = ''); document.getElementById('tipe').value = 'Pemasukan'; }

async function tambahData() {
  setLoading(true);
  try {
    const payload = { kategori: document.getElementById('kategori').value, keterangan: document.getElementById('keterangan').value, tanggal: document.getElementById('tanggal').value, jumlah: document.getElementById('jumlah').value, tipe: document.getElementById('tipe').value };
    await fetchJson(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    clearForm(); await refreshAllViews(); showToast('Transaksi tersimpan');
  } catch (err) { showToast(err.message); } finally { setLoading(false); }
}

async function hapusData(id) {
  if (!confirm('Yakin ingin menghapus transaksi ini?')) return;
  await fetchJson(api + '/' + id, { method: 'DELETE' });
  await refreshAllViews(); showToast('Transaksi dihapus');
}

async function editData(item) {
  document.getElementById('kategori').value = item.kategori || '';
  document.getElementById('keterangan').value = item.keterangan || '';
  document.getElementById('tanggal').value = formatInputDate(item.created_at);
  document.getElementById('jumlah').value = item.jumlah;
  document.getElementById('tipe').value = item.tipe;
  const tombol = document.querySelector('.btn-submit');
  tombol.innerHTML = 'Update Transaksi';
  tombol.onclick = async () => {
    try {
      await fetchJson(api + '/' + item.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kategori: document.getElementById('kategori').value, keterangan: document.getElementById('keterangan').value, tanggal: document.getElementById('tanggal').value, jumlah: document.getElementById('jumlah').value, tipe: document.getElementById('tipe').value }) });
      clearForm(); tombol.innerHTML = 'Tambah Transaksi'; tombol.onclick = tambahData; await refreshAllViews(); showToast('Transaksi diperbarui');
    } catch (err) { showToast(err.message); }
  };
}

async function loadCategories() {
  const categories = await fetchJson(api + '/categories').catch(() => []);
  const select = document.getElementById('categoryFilter');
  if (!select || !Array.isArray(categories)) return;
  select.innerHTML = '<option value="">Semua</option>' + categories.map((item) => `<option value="${item}">${item}</option>`).join('');
}

async function refreshInsights() {
  const month = document.getElementById('monthTo').value || document.getElementById('monthFrom').value || new Date().toISOString().slice(0, 7);
  const data = await fetchJson(api + '/insights?month=' + encodeURIComponent(month)).catch(() => null);
  const box = document.getElementById('insightList');
  if (!box || !data) return;
  box.innerHTML = data.insights.map((item) => `<div class="insight-item"><strong>${item.title}</strong><p>${item.message}</p></div>`).join('');
}

async function loadBudgets() {
  const month = document.getElementById('budgetMonth').value || new Date().toISOString().slice(0, 7);
  document.getElementById('budgetMonth').value = month;
  const data = await fetchJson(financeApi + '/budgets?month=' + encodeURIComponent(month)).catch(() => []);
  const box = document.getElementById('budgetList');
  if (!box || !Array.isArray(data)) return;
  box.innerHTML = data.length ? data.map((item) => { const percent = item.limit > 0 ? Math.min(100, Math.round((item.spent / item.limit) * 100)) : 0; return `<div class="mini-item"><strong>${item.kategori}</strong><p>${rupiah(item.spent)} / ${rupiah(item.limit)} (${percent}%)</p><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div></div>`; }).join('') : '<div class="mini-item"><p>Belum ada budget bulan ini.</p></div>';
}

async function saveBudget() {
  try {
    await fetchJson(financeApi + '/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bulan: document.getElementById('budgetMonth').value, kategori: document.getElementById('budgetKategori').value, limit: document.getElementById('budgetLimit').value }) });
    document.getElementById('budgetKategori').value = ''; document.getElementById('budgetLimit').value = ''; await loadBudgets(); showToast('Budget tersimpan');
  } catch (err) { showToast(err.message); }
}

async function loadGoals() {
  const data = await fetchJson(financeApi + '/goals').catch(() => []);
  const box = document.getElementById('goalList');
  if (!box || !Array.isArray(data)) return;
  box.innerHTML = data.length ? data.map((item) => { const percent = item.target > 0 ? Math.min(100, Math.round((item.current / item.target) * 100)) : 0; return `<div class="mini-item"><strong>${item.nama}</strong><p>${rupiah(item.current)} / ${rupiah(item.target)} (${percent}%)</p><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div></div>`; }).join('') : '<div class="mini-item"><p>Belum ada target tabungan.</p></div>';
}

async function saveGoal() {
  try {
    await fetchJson(financeApi + '/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nama: document.getElementById('goalName').value, target: document.getElementById('goalTarget').value, current: document.getElementById('goalCurrent').value }) });
    ['goalName','goalTarget','goalCurrent'].forEach(id => document.getElementById(id).value = ''); await loadGoals(); showToast('Target tersimpan');
  } catch (err) { showToast(err.message); }
}

async function updateProfile() {
  const nama = document.getElementById('profileNama').value.trim();
  if (!nama) return showToast('Nama wajib diisi');
  try {
    const data = await fetchJson(apiBase + '/auth/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nama }) });
    localStorage.setItem(AUTH_TOKEN_KEY, data.token); localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user)); document.getElementById('profileName').textContent = data.user.nama; showToast('Profil diperbarui');
  } catch (err) { showToast(err.message); }
}

function exportCsv() { const v = getTableFilterValues(); window.open(api + '/export.csv' + buildQuery({ start_date: v.startDate, end_date: v.endDate, search: v.search, kategori: v.kategori, tipe: v.tipe }), '_blank'); }

async function refreshAllViews() {
  const v = getTableFilterValues();
  const daily = getDailyFilterValues();
  const monthly = getMonthlyFilterValues();
  await Promise.all([loadTableData(v.startDate, v.endDate, v.limit, v.search, v.kategori, v.tipe), loadDailyChart(daily.startDate, daily.endDate), loadMonthlyChart(monthly.monthFrom, monthly.monthTo), loadCategories(), refreshInsights(), loadBudgets(), loadGoals()]);
}

window.addEventListener('DOMContentLoaded', () => {
  const storedUser = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || '{}');
  document.getElementById('profileName').textContent = storedUser.nama || storedUser.username || 'User';
  document.getElementById('profileNama').value = storedUser.nama || '';
  document.getElementById('logoutButton').addEventListener('click', () => { localStorage.removeItem(AUTH_TOKEN_KEY); localStorage.removeItem(AUTH_USER_KEY); window.location.href = '/'; });
  refreshAllViews();
});