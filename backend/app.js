const express = require("express");
const cors = require("cors");

const transaksiRoute = require("./routes/transaksi");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "API MasMoney berjalan",
  });
});

app.use("/transaksi", transaksiRoute);

module.exports = app;