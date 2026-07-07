const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "masmoney-dev-secret-change-me";

function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) {
      return res.status(401).json({ error: "Login diperlukan." });
    }

    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Sesi login tidak valid." });
  }
}

module.exports = { requireAuth, JWT_SECRET };
