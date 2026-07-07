const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { requireAuth } = require("../middleware/auth");

router.use(requireAuth);

function mapTransaction(r) {
  return { id: r.id, kategori: r.keterangan || "", keterangan: r.keterangan || "", jumlah: Number(r.nominal), tipe: r.tipe === "masuk" ? "Pemasukan" : "Pengeluaran", created_at: r.created_at };
}

router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const month = req.query.month;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const limit = parseInt(req.query.limit, 10);
    let sql = "SELECT * FROM transaksi WHERE user_id = $1";
    const params = [userId];
    if (month) { params.push(month); sql += ` AND TO_CHAR(created_at, 'YYYY-MM') = $${params.length}`; }
    if (startDate) { params.push(`${startDate} 00:00:00`); sql += ` AND created_at >= $${params.length}`; }
    if (endDate) { params.push(`${endDate} 23:59:59`); sql += ` AND created_at <= $${params.length}`; }
    sql += " ORDER BY id DESC";
    if (!Number.isNaN(limit) && limit > 0) sql += ` LIMIT ${limit}`;
    const result = await db.query(sql, params);
    res.json(result.rows.map(mapTransaction));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/summary", async (req, res) => {
  try {
    const month = req.query.month;
    if (!month) return res.status(400).json({ error: "month query param required, format YYYY-MM" });
    const result = await db.query(`SELECT tipe, SUM(nominal) AS total FROM transaksi WHERE user_id = $1 AND TO_CHAR(created_at, 'YYYY-MM') = $2 GROUP BY tipe`, [req.user.id, month]);
    let pemasukan = 0;
    let pengeluaran = 0;
    result.rows.forEach((r) => { if (r.tipe === "masuk") pemasukan = Number(r.total) || 0; if (r.tipe === "keluar") pengeluaran = Number(r.total) || 0; });
    res.json({ pemasukan, pengeluaran });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { kategori, keterangan, jumlah, tipe, tanggal } = req.body;
    const keteranganToSave = keterangan || kategori || "";
    const nominal = Number(jumlah) || 0;
    const tipeDb = (tipe || "").toLowerCase() === "pengeluaran" ? "keluar" : "masuk";
    const createdAt = tanggal ? `${tanggal} 00:00:00` : new Date().toISOString();
    const result = await db.query(`INSERT INTO transaksi (user_id, tipe, nominal, keterangan, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [req.user.id, tipeDb, nominal, keteranganToSave, createdAt]);
    res.status(201).json({ message: "Data berhasil ditambahkan", data: mapTransaction(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { kategori, keterangan, jumlah, tipe, tanggal } = req.body;
    const keteranganToSave = keterangan || kategori || "";
    const nominal = Number(jumlah) || 0;
    const tipeDb = (tipe || "").toLowerCase() === "pengeluaran" ? "keluar" : "masuk";
    const createdAt = tanggal ? `${tanggal} 00:00:00` : null;
    const result = await db.query(`UPDATE transaksi SET tipe = $1, nominal = $2, keterangan = $3, created_at = COALESCE($4, created_at) WHERE id = $5 AND user_id = $6 RETURNING *`, [tipeDb, nominal, keteranganToSave, createdAt, req.params.id, req.user.id]);
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
