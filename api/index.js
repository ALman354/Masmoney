const app = require("../backend/app");

module.exports = (req, res) => {
  return app(req, res);
};
