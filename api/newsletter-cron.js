const newsletter = require("./newsletter.js");

module.exports = (req, res) => {
  req.query = { ...(req.query || {}), action: "publish-due" };
  return newsletter(req, res);
};
