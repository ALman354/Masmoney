const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { requireAuth } = require("../middleware/auth");

router.use(requireAuth);

router.get("/budgets", async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const budgets = await db.query("SELECT * FROM budgets WHERE user_id = $1 AND bulan = $2 ORDER BY kategori ASC", [req.user.id, month]);
    const spending = await db.query(
      `SELECT kategori, SUM(nominal) AS spent FROM transaksi WHERE user_id = $1 AND tipe = 'keluar' AND TO_CHAR(created_at, 'YYYY-MM') = $2 GROUP BY kategori`,
      [req.user.id, month]
    );
    const spentByCategory = Object.fromEntries(spending.rows.map((row) => [row.kategori, Number(row.spent)]));
    res.json(budgets.rows.map((row) => ({
      id: row.id,
      kategori: row.kategori,
      bulan: row.bulan,
      limit: Number(row.limit_amount),
      spent: spentByCategory[row.kategori] || 0,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/budgets", async (req, res) => {
  try {
    const kategori = String(req.body.kategori || "").trim();
    const bulan = String(req.body.bulan || new Date().toISOString().slice(0, 7));
    const limit = Number(req.body.limit);
    if (!kategori || !bulan || limit <= 0) return res.status(400).json({ error: "Kategori, bulan, dan limit wajib valid." });
    const result = await db.query(
      `INSERT INTO budgets (user_id, kategori, bulan, limit_amount)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, kategori, bulan)
       DO UPDATE SET limit_amount = EXCLUDED.limit_amount
       RETURNING *`,
      [req.user.id, kategori, bulan, limit]
    );
    res.status(201).json({ message: "Budget tersimpan", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/budgets/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM budgets WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    res.json({ message: "Budget dihapus" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/goals", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM goals WHERE user_id = $1 ORDER BY id DESC", [req.user.id]);
    res.json(result.rows.map((row) => ({ id: row.id, nama: row.nama, target: Number(row.target_amount), current: Number(row.current_amount) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/goals", async (req, res) => {
  try {
    const nama = String(req.body.nama || "").trim();
    const target = Number(req.body.target);
    const current = Number(req.body.current || 0);
    if (!nama || target <= 0 || current < 0) return res.status(400).json({ error: "Nama target dan nominal wajib valid." });
    const result = await db.query(
      "INSERT INTO goals (user_id, nama, target_amount, current_amount) VALUES ($1, $2, $3, $4) RETURNING *",
      [req.user.id, nama, target, current]
    );
    res.status(201).json({ message: "Target tersimpan", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/goals/:id", async (req, res) => {
  try {
    const current = Number(req.body.current);
    if (current < 0) return res.status(400).json({ error: "Progress tidak boleh minus." });
    const result = await db.query("UPDATE goals SET current_amount = $1 WHERE id = $2 AND user_id = $3 RETURNING *", [current, req.params.id, req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Target tidak ditemukan." });
    res.json({ message: "Progress target diperbarui", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/goals/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM goals WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    res.json({ message: "Target dihapus" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;