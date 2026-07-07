const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../database/db");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, nama: user.nama },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function publicUser(user) {
  return { id: user.id, nama: user.nama, username: user.username };
}

router.post("/register", async (req, res) => {
  try {
    const nama = String(req.body.nama || "").trim();
    const username = String(req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!nama || !username || password.length < 6) {
      return res.status(400).json({ error: "Nama dan username wajib diisi, password minimal 6 karakter." });
    }

    const existing = await db.query(
      "SELECT id, nama, username, password_hash FROM users WHERE username = $1",
      [username]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Username sudah digunakan." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (nama, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, nama, username`,
      [nama, username, passwordHash]
    );

    const user = result.rows[0];
    res.status(201).json({ message: "Registrasi berhasil", token: createToken(user), user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({ error: "Username dan password wajib diisi." });
    }

    const result = await db.query(
      "SELECT id, nama, username, password_hash FROM users WHERE username = $1",
      [username]
    );

    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Username atau password salah." });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Username atau password salah." });

    res.json({ message: "Login berhasil", token: createToken(user), user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/me", async (req, res) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Token tidak ditemukan." });

    const payload = jwt.verify(token, JWT_SECRET);
    const result = await db.query("SELECT id, nama, username FROM users WHERE id = $1", [payload.id]);
    if (!result.rows[0]) return res.status(401).json({ error: "User tidak ditemukan." });

    res.json({ user: publicUser(result.rows[0]) });
  } catch (err) {
    res.status(401).json({ error: "Token tidak valid." });
  }
});

module.exports = router;
