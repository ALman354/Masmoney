const express = require("express");
const cors = require("cors");
const path = require("path");

const transaksiRoute = require("./routes/transaksi");

const app = express();
const frontendPath = path.join(__dirname, "..", "frontend");

app.use(cors());
app.use(express.json());
app.use(express.static(frontendPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.use("/transaksi", transaksiRoute);

module.exports = app;