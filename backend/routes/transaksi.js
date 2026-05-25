const express = require("express");
const router = express.Router();

const db = require("../database/db");

// GET /transaksi - get all (map DB fields to frontend expected fields)
// supports optional query param ?month=YYYY-MM to filter by month
router.get("/", (req, res) => {
	const month = req.query.month;
	const startDate = req.query.start_date;
	const endDate = req.query.end_date;
	const limit = parseInt(req.query.limit, 10);

	let sql = "SELECT * FROM transaksi";
	const params = [];
	const conditions = [];

	if (month) {
		conditions.push("DATE_FORMAT(created_at, '%Y-%m') = ?");
		params.push(month);
	}

	if (startDate) {
		conditions.push("created_at >= ?");
		params.push(`${startDate} 00:00:00`);
	}

	if (endDate) {
		conditions.push("created_at <= ?");
		params.push(`${endDate} 23:59:59`);
	}

	if (conditions.length) {
		sql += " WHERE " + conditions.join(" AND ");
	}

	sql += " ORDER BY id DESC";
	if (!Number.isNaN(limit) && limit > 0) {
		sql += " LIMIT " + limit;
	}

	db.query(sql, params, (err, result) => {
		if (err) return res.status(500).json({ error: err.message });

		const mapped = result.map((r) => ({
			id: r.id,
			kategori: r.kategori || r.keterangan || "",
			keterangan: r.keterangan,
			jumlah: r.nominal,
			tipe: r.tipe === "masuk" ? "Pemasukan" : "Pengeluaran",
			created_at: r.created_at,
		}));

		res.json(mapped);
	});
});

// GET /transaksi/summary?month=YYYY-MM - return totals for the month
router.get("/summary", (req, res) => {
	const month = req.query.month;
	if (!month) return res.status(400).json({ error: "month query param required, format YYYY-MM" });

	const sql = "SELECT tipe, SUM(nominal) AS total FROM transaksi WHERE DATE_FORMAT(created_at, '%Y-%m') = ? GROUP BY tipe";
	db.query(sql, [month], (err, rows) => {
		if (err) return res.status(500).json({ error: err.message });

		let pemasukan = 0;
		let pengeluaran = 0;
		rows.forEach((r) => {
			if (r.tipe === 'masuk') pemasukan = Number(r.total) || 0;
			if (r.tipe === 'keluar') pengeluaran = Number(r.total) || 0;
		});

		res.json({ pemasukan, pengeluaran });
	});
});

// POST /transaksi - create
router.post("/", (req, res) => {
	// accept frontend fields and map to DB columns
	const { kategori, keterangan, jumlah, tipe, tanggal } = req.body;

	const keteranganToSave = keterangan || kategori || "";
	const nominal = Number(jumlah) || 0;
	const tipeLower = (tipe || "").toLowerCase();
	const tipeDb = tipeLower === "pengeluaran" ? "keluar" : "masuk";
	const createdAt = tanggal ? `${tanggal} 00:00:00` : new Date().toISOString().slice(0, 19).replace('T', ' ');

	db.query(
		"INSERT INTO transaksi(tipe, nominal, keterangan, created_at) VALUES (?,?,?,?)",
		[tipeDb, nominal, keteranganToSave, createdAt],
		(err, result) => {
			if (err) return res.status(500).json({ error: err.message });
			res.json(result);
		}
	);
});

// PUT /transaksi/:id - update
router.put("/:id", (req, res) => {
	const id = req.params.id;
	const { kategori, keterangan, jumlah, tipe, tanggal } = req.body;

	const keteranganToSave = keterangan || kategori || "";
	const nominal = Number(jumlah) || 0;
	const tipeLower = (tipe || "").toLowerCase();
	const tipeDb = tipeLower === "pengeluaran" ? "keluar" : "masuk";

	if (tanggal) {
		const createdAt = `${tanggal} 00:00:00`;
		db.query(
			"UPDATE transaksi SET tipe=?, nominal=?, keterangan=?, created_at=? WHERE id=?",
			[tipeDb, nominal, keteranganToSave, createdAt, id],
			(err, result) => {
				if (err) return res.status(500).json({ error: err.message });
				res.json({ message: "Data berhasil diupdate" });
			}
		);
	} else {
		db.query(
			"UPDATE transaksi SET tipe=?, nominal=?, keterangan=? WHERE id=?",
			[tipeDb, nominal, keteranganToSave, id],
			(err, result) => {
				if (err) return res.status(500).json({ error: err.message });
				res.json({ message: "Data berhasil diupdate" });
			}
		);
	}
});

// DELETE /transaksi/:id - delete
router.delete("/:id", (req, res) => {
	const id = req.params.id;
	db.query("DELETE FROM transaksi WHERE id=?", [id], (err, result) => {
		if (err) return res.status(500).json({ error: err.message });
		res.json({ message: "Data berhasil dihapus" });
	});
});

module.exports = router;