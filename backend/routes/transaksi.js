const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { requireAuth } = require("../middleware/auth");

router.use(requireAuth);

function mapTransaction(r) {
  return {
    id: r.id,
    kategori: r.kategori || r.keterangan || "",
    keterangan: r.keterangan || "",
    jumlah: Number(r.nominal),
    tipe: r.tipe === "masuk" ? "Pemasukan" : "Pengeluaran",
    created_at: r.created_at,
  };
}

function csvEscape(value) {
  const str = String(value ?? "");
  return `"${str.replace(/"/g, '""')}"`;
}

function buildTransactionQuery(req) {
  const month = req.query.month;
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;
  const kategori = req.query.kategori;
  const tipe = req.query.tipe;
  const search = req.query.search;
  const limit = parseInt(req.query.limit, 10);

  let sql = "SELECT * FROM transaksi WHERE user_id = $1";
  const params = [req.user.id];

  if (month) {
    params.push(month);
    sql += ` AND TO_CHAR(created_at, 'YYYY-MM') = $${params.length}`;
  }
  if (startDate) {
    params.push(`${startDate} 00:00:00`);
    sql += ` AND created_at >= $${params.length}`;
  }
  if (endDate) {
    params.push(`${endDate} 23:59:59`);
    sql += ` AND created_at <= $${params.length}`;
  }
  if (kategori) {
    params.push(kategori);
    sql += ` AND kategori = $${params.length}`;
  }
  if (tipe) {
    params.push(String(tipe).toLowerCase() === "pengeluaran" || tipe === "keluar" ? "keluar" : "masuk");
    sql += ` AND tipe = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (keterangan ILIKE $${params.length} OR kategori ILIKE $${params.length})`;
  }

  sql += " ORDER BY id DESC";
  if (!Number.isNaN(limit) && limit > 0) sql += ` LIMIT ${limit}`;
  return { sql, params };
}

router.get("/", async (req, res) => {
  try {
    const { sql, params } = buildTransactionQuery(req);
    const result = await db.query(sql, params);
    res.json(result.rows.map(mapTransaction));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT DISTINCT kategori FROM transaksi WHERE user_id = $1 AND kategori IS NOT NULL AND kategori <> '' ORDER BY kategori ASC",
      [req.user.id]
    );
    res.json(result.rows.map((row) => row.kategori));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/export.csv", async (req, res) => {
  try {
    const { sql, params } = buildTransactionQuery(req);
    const result = await db.query(sql.replace(/ LIMIT \d+$/i, ""), params);
    const rows = result.rows.map(mapTransaction);
    const csv = [
      ["Tanggal", "Kategori", "Keterangan", "Tipe", "Jumlah"].map(csvEscape).join(","),
      ...rows.map((row) => [row.created_at, row.kategori, row.keterangan, row.tipe, row.jumlah].map(csvEscape).join(",")),
    ].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=masmoney-transaksi.csv");
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/insights", async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const result = await db.query(
      `SELECT kategori, tipe, SUM(nominal) AS total, COUNT(*) AS jumlah
       FROM transaksi
       WHERE user_id = $1 AND TO_CHAR(created_at, 'YYYY-MM') = $2
       GROUP BY kategori, tipe`,
      [req.user.id, month]
    );

    const rows = result.rows;
    const pemasukan = rows.filter((r) => r.tipe === "masuk").reduce((sum, r) => sum + Number(r.total), 0);
    const pengeluaran = rows.filter((r) => r.tipe === "keluar").reduce((sum, r) => sum + Number(r.total), 0);
    const biggestExpense = rows
      .filter((r) => r.tipe === "keluar")
      .sort((a, b) => Number(b.total) - Number(a.total))[0];

    const insights = [];
    insights.push({ title: "Saldo bulan ini", message: `Saldo ${month}: Rp ${(pemasukan - pengeluaran).toLocaleString("id-ID")}.` });
    if (biggestExpense) {
      insights.push({ title: "Pengeluaran terbesar", message: `${biggestExpense.kategori || "Tanpa kategori"} menjadi pengeluaran terbesar: Rp ${Number(biggestExpense.total).toLocaleString("id-ID")}.` });
    }
    insights.push({ title: "Rasio pengeluaran", message: pemasukan > 0 ? `Pengeluaran mencapai ${Math.round((pengeluaran / pemasukan) * 100)}% dari pemasukan.` : "Belum ada pemasukan pada bulan ini." });

    res.json({ month, pemasukan, pengeluaran, insights });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { kategori, keterangan, jumlah, tipe, tanggal } = req.body;
    const kategoriToSave = String(kategori || "Lainnya").trim();
    const keteranganToSave = String(keterangan || "").trim();
    const nominal = Number(jumlah) || 0;
    const tipeDb = (tipe || "").toLowerCase() === "pengeluaran" ? "keluar" : "masuk";
    const createdAt = tanggal ? `${tanggal} 00:00:00` : new Date().toISOString();

    if (!kategoriToSave || !keteranganToSave || nominal <= 0) {
      return res.status(400).json({ error: "Kategori, keterangan, dan jumlah lebih dari 0 wajib diisi." });
    }

    const result = await db.query(
      `INSERT INTO transaksi (user_id, kategori, tipe, nominal, keterangan, created_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, kategoriToSave, tipeDb, nominal, keteranganToSave, createdAt]
    );
    res.status(201).json({ message: "Data berhasil ditambahkan", data: mapTransaction(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { kategori, keterangan, jumlah, tipe, tanggal } = req.body;
    const kategoriToSave = String(kategori || "Lainnya").trim();
    const keteranganToSave = String(keterangan || "").trim();
    const nominal = Number(jumlah) || 0;
    const tipeDb = (tipe || "").toLowerCase() === "pengeluaran" ? "keluar" : "masuk";
    const createdAt = tanggal ? `${tanggal} 00:00:00` : null;

    if (!kategoriToSave || !keteranganToSave || nominal <= 0) {
      return res.status(400).json({ error: "Kategori, keterangan, dan jumlah lebih dari 0 wajib diisi." });
    }

    const result = await db.query(
      `UPDATE transaksi
       SET kategori = $1, tipe = $2, nominal = $3, keterangan = $4, created_at = COALESCE($5, created_at)
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [kategoriToSave, tipeDb, nominal, keteranganToSave, createdAt, req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Transaksi tidak ditemukan." });
    res.json({ message: "Data berhasil diupdate", data: mapTransaction(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM transaksi WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    res.json({ message: "Data berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;