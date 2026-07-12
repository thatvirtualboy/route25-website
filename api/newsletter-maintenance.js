const newsletter = require("./newsletter.js");

module.exports = (req, res) => {
  req.query = { ...(req.query || {}), action: "maintenance" };
  return newsletter(req, res);
};
