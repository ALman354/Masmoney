const express = require("express");
const router = express.Router();
const db = require("../database/db");

// GET /transaksi
router.get("/", async (req, res) => {
  try {
    const month = req.query.month;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const limit = parseInt(req.query.limit, 10);

    let sql = "SELECT * FROM transaksi";
    const params = [];
    const conditions = [];

    if (month) {
      params.push(month);
      conditions.push(`TO_CHAR(created_at, 'YYYY-MM') = $${params.length}`);
    }

    if (startDate) {
      params.push(`${startDate} 00:00:00`);
      conditions.push(`created_at >= $${params.length}`);
    }

    if (endDate) {
      params.push(`${endDate} 23:59:59`);
      conditions.push(`created_at <= $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY id DESC";

    if (!Number.isNaN(limit) && limit > 0) {
      sql += ` LIMIT ${limit}`;
    }

    const result = await db.query(sql, params);

    const mapped = result.rows.map((r) => ({
      id: r.id,
      kategori: r.keterangan || "",
      keterangan: r.keterangan || "",
      jumlah: Number(r.nominal),
      tipe: r.tipe === "masuk" ? "Pemasukan" : "Pengeluaran",
      created_at: r.created_at,
    }));

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /transaksi/summary?month=YYYY-MM
router.get("/summary", async (req, res) => {
  try {
    const month = req.query.month;

    if (!month) {
      return res.status(400).json({
        error: "month query param required, format YYYY-MM",
      });
    }

    const sql = `
      SELECT tipe, SUM(nominal) AS total
      FROM transaksi
      WHERE TO_CHAR(created_at, 'YYYY-MM') = $1
      GROUP BY tipe
    `;

    const result = await db.query(sql, [month]);

    let pemasukan = 0;
    let pengeluaran = 0;

    result.rows.forEach((r) => {
      if (r.tipe === "masuk") pemasukan = Number(r.total) || 0;
      if (r.tipe === "keluar") pengeluaran = Number(r.total) || 0;
    });

    res.json({ pemasukan, pengeluaran });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /transaksi
router.post("/", async (req, res) => {
  try {
    const { kategori, keterangan, jumlah, tipe, tanggal } = req.body;

    const keteranganToSave = keterangan || kategori || "";
    const nominal = Number(jumlah) || 0;
    const tipeLower = (tipe || "").toLowerCase();
    const tipeDb = tipeLower === "pengeluaran" ? "keluar" : "masuk";

    const createdAt = tanggal
      ? `${tanggal} 00:00:00`
      : new Date().toISOString();

    const sql = `
      INSERT INTO transaksi (tipe, nominal, keterangan, created_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await db.query(sql, [
      tipeDb,
      nominal,
      keteranganToSave,
      createdAt,
    ]);

    res.json({
      message: "Data berhasil ditambahkan",
      data: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /transaksi/:id
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { kategori, keterangan, jumlah, tipe, tanggal } = req.body;

    const keteranganToSave = keterangan || kategori || "";
    const nominal = Number(jumlah) || 0;
    const tipeLower = (tipe || "").toLowerCase();
    const tipeDb = tipeLower === "pengeluaran" ? "keluar" : "masuk";

    let sql;
    let params;

    if (tanggal) {
      const createdAt = `${tanggal} 00:00:00`;

      sql = `
        UPDATE transaksi
        SET tipe = $1, nominal = $2, keterangan = $3, created_at = $4
        WHERE id = $5
        RETURNING *
      `;

      params = [tipeDb, nominal, keteranganToSave, createdAt, id];
    } else {
      sql = `
        UPDATE transaksi
        SET tipe = $1, nominal = $2, keterangan = $3
        WHERE id = $4
        RETURNING *
      `;

      params = [tipeDb, nominal, keteranganToSave, id];
    }

    const result = await db.query(sql, params);

    res.json({
      message: "Data berhasil diupdate",
      data: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /transaksi/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    await db.query("DELETE FROM transaksi WHERE id = $1", [id]);

    res.json({ message: "Data berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;