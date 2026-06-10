const express = require("express");
const cors = require("cors");
const path = require("path");
const transaksiRoute = require("../backend/routes/transaksi");

const app = express();
const frontendPath = path.join(__dirname, "..", "frontend");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(frontendPath));

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.use("/transaksi", transaksiRoute);

// Export untuk Vercel serverless function
module.exports = (req, res) => {
  return app(req, res);
};
