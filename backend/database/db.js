const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
let useMemoryFallback = !connectionString;
let pgPool = null;
let pgConnected = false;

const demoPasswordHash = bcrypt.hashSync("admin123", 10);

const memoryState = {
  nextUserId: 2,
  nextTransactionId: 4,
  users: [
    { id: 1, nama: "Yusron", username: "admin", password_hash: demoPasswordHash, created_at: "2026-05-01T08:00:00.000Z" },
  ],
  rows: [
    { id: 1, user_id: 1, tipe: "masuk", nominal: 5000000, keterangan: "Gaji", created_at: "2026-05-01T08:00:00.000Z" },
    { id: 2, user_id: 1, tipe: "keluar", nominal: 250000, keterangan: "Belanja", created_at: "2026-05-03T08:00:00.000Z" },
    { id: 3, user_id: 1, tipe: "masuk", nominal: 1200000, keterangan: "Investasi", created_at: "2026-05-10T08:00:00.000Z" },
  ],
};

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(`${str}T00:00:00`);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) return new Date(str.replace(" ", "T"));
  return new Date(str);
}

function cloneRow(row) {
  return { ...row };
}

function getParam(sql, params, pattern) {
  const match = sql.match(pattern);
  return match ? params[Number(match[1]) - 1] : undefined;
}

function applyFilters(rows, sql, params) {
  let filtered = rows.slice();
  const userId = getParam(sql, params, /user_id\s*=\s*\$(\d+)/i);
  if (userId !== undefined) filtered = filtered.filter((row) => Number(row.user_id) === Number(userId));

  const month = getParam(sql, params, /TO_CHAR\(created_at, 'YYYY-MM'\)\s*=\s*\$(\d+)/i);
  if (month) {
    filtered = filtered.filter((row) => {
      const createdAt = parseDate(row.created_at);
      return createdAt && createdAt.toISOString().slice(0, 7) === String(month);
    });
  }

  const startValue = getParam(sql, params, /created_at\s*>=\s*\$(\d+)/i);
  if (startValue) {
    const startDate = parseDate(startValue);
    filtered = filtered.filter((row) => {
      const createdAt = parseDate(row.created_at);
      return createdAt && createdAt >= startDate;
    });
  }

  const endValue = getParam(sql, params, /created_at\s*<=\s*\$(\d+)/i);
  if (endValue) {
    const endDate = parseDate(endValue);
    filtered = filtered.filter((row) => {
      const createdAt = parseDate(row.created_at);
      return createdAt && createdAt <= endDate;
    });
  }

  filtered.sort((a, b) => Number(b.id) - Number(a.id));
  const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
  if (limitMatch) filtered = filtered.slice(0, Number(limitMatch[1]));
  return filtered;
}

function memoryQuery(sql, params = []) {
  const normalizedSql = String(sql).trim().replace(/\s+/g, " ").toUpperCase();

  if (normalizedSql.startsWith("SELECT ID, NAMA, USERNAME, PASSWORD_HASH FROM USERS WHERE USERNAME")) {
    const username = String(params[0] || "").toLowerCase();
    const user = memoryState.users.find((item) => item.username.toLowerCase() === username);
    return { rows: user ? [cloneRow(user)] : [] };
  }

  if (normalizedSql.startsWith("SELECT ID, NAMA, USERNAME FROM USERS WHERE ID")) {
    const user = memoryState.users.find((item) => Number(item.id) === Number(params[0]));
    return { rows: user ? [{ id: user.id, nama: user.nama, username: user.username }] : [] };
  }

  if (normalizedSql.startsWith("INSERT INTO USERS")) {
    const inserted = { id: memoryState.nextUserId++, nama: params[0], username: params[1], password_hash: params[2], created_at: new Date().toISOString() };
    memoryState.users.push(inserted);
    return { rows: [{ id: inserted.id, nama: inserted.nama, username: inserted.username }] };
  }

  if (normalizedSql.startsWith("SELECT * FROM TRANSAKSI")) {
    return { rows: applyFilters(memoryState.rows, sql, params).map(cloneRow) };
  }

  if (normalizedSql.startsWith("SELECT TIPE, SUM(NOMINAL) AS TOTAL FROM TRANSAKSI")) {
    const totals = applyFilters(memoryState.rows, sql, params).reduce((acc, row) => {
      acc[row.tipe] = (acc[row.tipe] || 0) + Number(row.nominal);
      return acc;
    }, {});
    return { rows: Object.entries(totals).map(([tipe, total]) => ({ tipe, total: Number(total) })) };
  }

  if (normalizedSql.startsWith("INSERT INTO TRANSAKSI")) {
    const inserted = { id: memoryState.nextTransactionId++, user_id: Number(params[0]), tipe: params[1], nominal: Number(params[2]), keterangan: params[3], created_at: params[4] };
    memoryState.rows.unshift(inserted);
    return { rows: [cloneRow(inserted)] };
  }

  if (normalizedSql.startsWith("UPDATE TRANSAKSI")) {
    const row = memoryState.rows.find((item) => Number(item.id) === Number(params[4]) && Number(item.user_id) === Number(params[5]));
    if (!row) return { rows: [] };
    row.tipe = params[0];
    row.nominal = Number(params[1]);
    row.keterangan = params[2];
    if (params[3]) row.created_at = params[3];
    return { rows: [cloneRow(row)] };
  }

  if (normalizedSql.startsWith("DELETE FROM TRANSAKSI")) {
    memoryState.rows = memoryState.rows.filter((row) => !(Number(row.id) === Number(params[0]) && Number(row.user_id) === Number(params[1])));
    return { rows: [] };
  }

  return { rows: [] };
}

async function initSchema() {
  if (!pgPool) return;
  await pgPool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, nama VARCHAR(100) NOT NULL, username VARCHAR(50) UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pgPool.query(`CREATE TABLE IF NOT EXISTS transaksi (id SERIAL PRIMARY KEY, tipe VARCHAR(20) NOT NULL, nominal NUMERIC NOT NULL, keterangan TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pgPool.query(`ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS user_id INTEGER`);

  const adminHash = bcrypt.hashSync("admin123", 10);
  const adminResult = await pgPool.query(
    `INSERT INTO users (nama, username, password_hash) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING RETURNING id`,
    ["Yusron", "admin", adminHash]
  );
  let adminId = adminResult.rows[0]?.id;
  if (!adminId) {
    const existing = await pgPool.query("SELECT id FROM users WHERE username = $1", ["admin"]);
    adminId = existing.rows[0]?.id;
  }
  if (adminId) await pgPool.query("UPDATE transaksi SET user_id = $1 WHERE user_id IS NULL", [adminId]);
  await pgPool.query(`ALTER TABLE transaksi ADD CONSTRAINT transaksi_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID`).catch((err) => {
    if (!String(err.message).includes("already exists")) throw err;
  });
}

const db = {
  query: async (sql, params = []) => {
    if (useMemoryFallback || !pgConnected) return memoryQuery(sql, params);
    try {
      return await pgPool.query(sql, params);
    } catch (err) {
      console.error("Database error, falling back to memory:", err.message);
      useMemoryFallback = true;
      pgConnected = false;
      return memoryQuery(sql, params);
    }
  },
  connect: async () => {
    if (useMemoryFallback) {
      console.log("Database fallback in-memory aktif");
      return true;
    }
    try {
      pgPool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
      await pgPool.query("SELECT 1");
      await initSchema();
      pgConnected = true;
      console.log("Database PostgreSQL terhubung");
      return true;
    } catch (err) {
      console.log("Database gagal, menggunakan fallback memory:", err.message);
      useMemoryFallback = true;
      pgConnected = false;
      return true;
    }
  },
  promise: () => ({ query: async (sql, params = []) => db.query(sql, params) }),
  end: () => { if (pgPool) pgPool.end().catch(() => {}); },
};

module.exports = db;

(async () => {
  await db.connect();
})();
