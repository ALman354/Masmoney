const db = require("./database/db");

const categories = [
  "Makan",
  "Transport",
  "Tagihan",
  "Belanja",
  "Gaji",
  "Investasi",
  "Hiburan",
  "Kesehatan",
  "Pulsa",
  "Listrik",
];

const tipeOptions = ["masuk", "keluar"];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pad(num) {
  return String(num).padStart(2, "0");
}

async function seed(days = 120) {
  const now = new Date();
  const inserts = [];

  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);

    for (let i = 0; i < 10; i++) {
      const tipe = i < 4 ? "masuk" : "keluar"; // sekitar 40% pemasukan, 60% pengeluaran
      const nominal = tipe === "masuk"
        ? randomInt(200000, 1500000)
        : randomInt(10000, 500000);
      const kategori = randomItem(categories);
      const keterangan = `${kategori} ${tipe === "masuk" ? "dana masuk" : "biaya"}`;
      const createdAt = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} 08:00:00`;

      inserts.push([tipe, nominal, keterangan, createdAt]);
    }
  }

  try {
    console.log(`Memasukkan ${inserts.length} transaksi...`);
    const [result] = await db.promise().query(
      "INSERT INTO transaksi (tipe, nominal, keterangan, created_at) VALUES ?",
      [inserts]
    );
    console.log(`Selesai! ${result.affectedRows} baris ditambahkan.`);
  } catch (err) {
    console.error("Gagal menambahkan data:", err.message);
  } finally {
    db.end();
  }
}

seed(120);
