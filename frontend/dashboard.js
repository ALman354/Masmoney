const api = "http://localhost:3000/transaksi";
let financeChart;
let recapChart;

function buildQuery(params) {
    const parts = [];
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        }
    });
    return parts.length ? `?${parts.join('&')}` : '';
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

async function fetchTransactions(params = {}) {
    const url = api + buildQuery(params);
    const response = await fetch(url);
    return await response.json();
}

function getTableFilterValues() {
    return {
        startDate: document.getElementById('startDateTable').value || '',
        endDate: document.getElementById('endDateTable').value || '',
        limit: document.getElementById('limitRecords').value || ''
    };
}

function getDailyFilterValues() {
    return {
        startDate: document.getElementById('startDateDaily').value || '',
        endDate: document.getElementById('endDateDaily').value || ''
    };
}

function getMonthlyFilterValues() {
    return {
        monthFrom: document.getElementById('monthFrom').value || '',
        monthTo: document.getElementById('monthTo').value || ''
    };
}

async function loadTableData(startDate, endDate, limit) {
    const params = { start_date: startDate, end_date: endDate, limit };
    const data = await fetchTransactions(params);
    renderTable(data);
}

async function loadDailyChart(startDate, endDate) {
    const params = { start_date: startDate, end_date: endDate };
    const data = await fetchTransactions(params);
    renderFinanceChart(data);
}

async function loadMonthlyChart(monthFrom, monthTo) {
    const { startDate, endDate } = monthRangeToDates(monthFrom, monthTo);
    const params = { start_date: startDate, end_date: endDate };
    const data = await fetchTransactions(params);
    renderRecapChart(data, monthFrom || monthTo);
}

function renderTable(data) {
    let html = '';
    let pemasukan = 0;
    let pengeluaran = 0;

    data.forEach(item => {
        html += `
<tr>
<td>${formatDate(item.created_at)}</td>
<td>${item.kategori || item.keterangan || ''}</td>
<td>${item.keterangan || ''}</td>
<td>${item.tipe}</td>
<td>Rp ${Number(item.jumlah).toLocaleString()}</td>
<td><button onclick='editData(${JSON.stringify(item)})' class="edit">Edit</button></td>
<td><button onclick="hapusData(${item.id})" class="hapus">Hapus</button></td>
</tr>`;

        if (item.tipe === 'Pemasukan') {
            pemasukan += Number(item.jumlah);
        } else {
            pengeluaran += Number(item.jumlah);
        }
    });

    document.getElementById('transaksiData').innerHTML = html;
    document.getElementById('masuk').innerHTML = 'Rp ' + pemasukan.toLocaleString();
    document.getElementById('keluar').innerHTML = 'Rp ' + pengeluaran.toLocaleString();
    document.getElementById('saldo').innerHTML = 'Rp ' + (pemasukan - pengeluaran).toLocaleString();
    document.getElementById('jumlahTransaksi').innerHTML = data.length;
}

function renderFinanceChart(dataItems) {
    const dailyTotals = {};
    dataItems.forEach((item) => {
        const day = item.created_at ? item.created_at.substring(0, 10) : '';
        if (!dailyTotals[day]) dailyTotals[day] = 0;
        dailyTotals[day] += item.tipe === 'Pengeluaran' ? -Number(item.jumlah) : Number(item.jumlah);
    });

    const labels = Object.keys(dailyTotals).sort();
    const values = labels.map((label) => dailyTotals[label]);

    const ctx = document.getElementById('financeChart').getContext('2d');

    if (financeChart) {
        financeChart.data.labels = labels;
        financeChart.data.datasets[0].data = values;
        financeChart.update();
        return;
    }

    financeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Saldo Harian',
                data: values,
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56,189,248,0.25)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#38bdf8',
                borderWidth: 3,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: '#fff' }
                },
                title: {
                    display: true,
                    text: 'Grafik Harian',
                    color: '#fff',
                    font: { size: 16 }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#fff' } },
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#fff' } }
            }
        }
    });
}

function renderRecapChart(dataItems, selectedMonth) {
    const totalsPerMonth = {};
    dataItems.forEach((item) => {
        const month = item.created_at ? item.created_at.substring(0, 7) : '';
        if (!month) return;
        if (!totalsPerMonth[month]) totalsPerMonth[month] = { pemasukan: 0, pengeluaran: 0 };
        if (item.tipe === 'Pengeluaran') {
            totalsPerMonth[month].pengeluaran += Number(item.jumlah);
        } else {
            totalsPerMonth[month].pemasukan += Number(item.jumlah);
        }
    });

    const labels = Object.keys(totalsPerMonth).sort();
    const pemasukanValues = labels.map((label) => totalsPerMonth[label].pemasukan);
    const pengeluaranValues = labels.map((label) => totalsPerMonth[label].pengeluaran);
    const displayMonth = selectedMonth || labels[labels.length - 1] || '-';
    const recapForMonth = totalsPerMonth[displayMonth] || { pemasukan: 0, pengeluaran: 0 };

    document.getElementById('rekapBulanDisplay').innerText = displayMonth;
    document.getElementById('rekapMasuk').innerText = 'Rp ' + recapForMonth.pemasukan.toLocaleString();
    document.getElementById('rekapKeluar').innerText = 'Rp ' + recapForMonth.pengeluaran.toLocaleString();

    const ctx = document.getElementById('recapChart').getContext('2d');
    if (recapChart) {
        recapChart.data.labels = labels;
        recapChart.data.datasets[0].data = pemasukanValues;
        recapChart.data.datasets[1].data = pengeluaranValues;
        recapChart.update();
        return;
    }

    recapChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Uang Masuk',
                    data: pemasukanValues,
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34,197,94,0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#22c55e',
                    borderWidth: 3,
                },
                {
                    label: 'Uang Keluar',
                    data: pengeluaranValues,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239,68,68,0.15)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#ef4444',
                    borderWidth: 3,
                },
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#fff' }
                },
                title: {
                    display: true,
                    text: 'Grafik Bulanan',
                    color: '#fff',
                    font: { size: 16 }
                }
            },
            scales: {
                x: { ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                y: { ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } }
            }
        }
    });
}

function applyDailyFilter() {
    const { startDate, endDate } = getDailyFilterValues();
    loadDailyChart(startDate, endDate);
}

function resetDailyFilter() {
    document.getElementById('startDateDaily').value = '';
    document.getElementById('endDateDaily').value = '';
    loadDailyChart();
}

function applyMonthlyFilter() {
    const { monthFrom, monthTo } = getMonthlyFilterValues();
    loadMonthlyChart(monthFrom, monthTo);
}

function resetMonthlyFilter() {
    document.getElementById('monthFrom').value = '';
    document.getElementById('monthTo').value = '';
    loadMonthlyChart();
}

function applyTableFilter() {
    const { startDate, endDate, limit } = getTableFilterValues();
    loadTableData(startDate, endDate, limit);
}

function resetTableFilter() {
    document.getElementById('startDateTable').value = '';
    document.getElementById('endDateTable').value = '';
    document.getElementById('limitRecords').value = '';
    loadTableData();
}

function formatDate(value){
	if(!value) return "";
	const date = new Date(value);
	if(Number.isNaN(date.getTime())) return value;
	return date.toLocaleDateString('id-ID', { year:'numeric', month:'2-digit', day:'2-digit' });
}

function formatInputDate(value){
	if(!value) return "";
	const date = new Date(value);
	if(Number.isNaN(date.getTime())) return "";
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function clearForm() {
    document.getElementById('kategori').value = '';
    document.getElementById('keterangan').value = '';
    document.getElementById('tanggal').value = '';
    document.getElementById('jumlah').value = '';
    document.getElementById('tipe').value = 'Pemasukan';
}

async function tambahData() {
    const kategori = document.getElementById('kategori').value;
    const keterangan = document.getElementById('keterangan').value;
    const tanggal = document.getElementById('tanggal').value;
    const jumlah = document.getElementById('jumlah').value;
    const tipe = document.getElementById('tipe').value;

    await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kategori, keterangan, tanggal, jumlah, tipe })
    });

    clearForm();
    await refreshAllViews();
}

async function hapusData(id) {
    await fetch(api + '/' + id, { method: 'DELETE' });
    await refreshAllViews();
}

async function editData(item) {
    const kategoriValue = item.kategori || item.keterangan || '';
    const keteranganValue = item.kategori && item.keterangan && item.kategori !== item.keterangan ? item.keterangan : '';

    document.getElementById('kategori').value = kategoriValue;
    document.getElementById('keterangan').value = keteranganValue;
    document.getElementById('tanggal').value = formatInputDate(item.created_at);
    document.getElementById('jumlah').value = item.jumlah;
    document.getElementById('tipe').value = item.tipe;

    const tombol = document.querySelector('.btn');
    tombol.innerHTML = 'Update';

    tombol.onclick = async () => {
        await fetch(api + '/' + item.id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                kategori: document.getElementById('kategori').value,
                keterangan: document.getElementById('keterangan').value,
                tanggal: document.getElementById('tanggal').value,
                jumlah: document.getElementById('jumlah').value,
                tipe: document.getElementById('tipe').value
            })
        });

        clearForm();
        tombol.innerHTML = 'Tambah';
        tombol.onclick = tambahData;
        await refreshAllViews();
    };
}

async function refreshAllViews() {
    const { startDate, endDate, limit } = getTableFilterValues();
    const { startDate: dailyFrom, endDate: dailyTo } = getDailyFilterValues();
    const { monthFrom, monthTo } = getMonthlyFilterValues();

    await Promise.all([
        loadTableData(startDate, endDate, limit),
        loadDailyChart(dailyFrom, dailyTo),
        loadMonthlyChart(monthFrom, monthTo)
    ]);
}

loadTableData();
loadDailyChart();
loadMonthlyChart();