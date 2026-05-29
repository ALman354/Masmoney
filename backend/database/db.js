const { Pool } = require("pg");

const useMemoryFallback = !process.env.DATABASE_URL;

const memoryState = {
  nextId: 1,
  rows: [
    {
      id: 1,
      tipe: "masuk",
      nominal: 5000000,
      keterangan: "Gaji",
      created_at: "2026-05-01T08:00:00.000Z",
    },
    {
      id: 2,
      tipe: "keluar",
      nominal: 250000,
      keterangan: "Belanja",
      created_at: "2026-05-03T08:00:00.000Z",
    },
    {
      id: 3,
      tipe: "masuk",
      nominal: 1200000,
      keterangan: "Investasi",
      created_at: "2026-05-10T08:00:00.000Z",
    },
  ],
};

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const str = String(value).trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(`${str}T00:00:00`);
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
    return new Date(str.replace(" ", "T"));
  }

  return new Date(str);
}

function cloneRow(row) {
  return { ...row };
}

function applyFilters(rows, sql, params) {
  let filtered = rows.slice();

  const monthMatch = sql.match(/TO_CHAR\(created_at, 'YYYY-MM'\) = \$(\d+)/i);
  if (monthMatch) {
    const month = params[Number(monthMatch[1]) - 1];
    filtered = filtered.filter((row) => {
      const createdAt = parseDate(row.created_at);
      return createdAt && createdAt.toISOString().slice(0, 7) === String(month);
    });
  }

  const startMatch = sql.match(/created_at >= \$(\d+)/i);
  if (startMatch) {
    const startValue = params[Number(startMatch[1]) - 1];
    const startDate = parseDate(startValue);
    filtered = filtered.filter((row) => {
      const createdAt = parseDate(row.created_at);
      return createdAt && createdAt >= startDate;
    });
  }

  const endMatch = sql.match(/created_at <= \$(\d+)/i);
  if (endMatch) {
    const endValue = params[Number(endMatch[1]) - 1];
    const endDate = parseDate(endValue);
    filtered = filtered.filter((row) => {
      const createdAt = parseDate(row.created_at);
      return createdAt && createdAt <= endDate;
    });
  }

  filtered.sort((a, b) => Number(b.id) - Number(a.id));

  const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
  if (limitMatch) {
    const limit = Number(limitMatch[1]);
    filtered = filtered.slice(0, limit);
  }

  return filtered;
}

function memoryQuery(sql, params = []) {
  const normalizedSql = String(sql).trim().toUpperCase();

  if (normalizedSql.startsWith("SELECT * FROM TRANSAKSI")) {
    const filtered = applyFilters(memoryState.rows, sql, params);
    return { rows: filtered.map((row) => cloneRow(row)) };
  }

  if (normalizedSql.startsWith("SELECT TIPE, SUM(NOMINAL) AS TOTAL FROM TRANSAKSI")) {
    const month = params[0];
    const filtered = memoryState.rows.filter((row) => {
      const createdAt = parseDate(row.created_at);
      return createdAt && createdAt.toISOString().slice(0, 7) === String(month);
    });

    const totals = filtered.reduce((acc, row) => {
      acc[row.tipe] = (acc[row.tipe] || 0) + Number(row.nominal);
      return acc;
    }, {});

    return {
      rows: Object.entries(totals).map(([tipe, total]) => ({
        tipe,
        total: Number(total),
      })),
    };
  }

  if (normalizedSql.startsWith("INSERT INTO TRANSAKSI")) {
    const [, , , , createdAt] = params;
    const inserted = {
      id: memoryState.nextId++,
      tipe: params[0],
      nominal: Number(params[1]),
      keterangan: params[2],
      created_at: createdAt,
    };
    memoryState.rows.unshift(inserted);
    return { rows: [cloneRow(inserted)] };
  }

  if (normalizedSql.startsWith("UPDATE TRANSAKSI")) {
    const id = Number(params[4]);
    const row = memoryState.rows.find((item) => Number(item.id) === id);
    if (!row) return { rows: [] };

    row.tipe = params[0];
    row.nominal = Number(params[1]);
    row.keterangan = params[2];
    if (params[3]) row.created_at = params[3];

    return { rows: [cloneRow(row)] };
  }

  if (normalizedSql.startsWith("DELETE FROM TRANSAKSI")) {
    const id = Number(params[0]);
    memoryState.rows = memoryState.rows.filter((row) => Number(row.id) !== id);
    return { rows: [] };
  }

  return { rows: [] };
}

const db = useMemoryFallback ? {
  query: async (sql, params = []) => memoryQuery(sql, params),
  connect: async () => {
    console.log("Database fallback in-memory aktif");
    return true;
  },
  promise: () => ({
    query: (sql, params = []) => memoryQuery(sql, params),
  }),
  end: () => {},
} : new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

if (!useMemoryFallback) {
  db.connect()
    .then(() => {
      console.log("Database PostgreSQL terhubung");
    })
    .catch((err) => {
      console.log("Database gagal:", err.message);
    });
}

module.exports = db;