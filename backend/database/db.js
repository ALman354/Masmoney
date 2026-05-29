const { Pool } = require("pg");

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

db.connect()
  .then(() => {
    console.log("Database PostgreSQL terhubung");
  })
  .catch((err) => {
    console.log("Database gagal:", err.message);
  });

module.exports = db;