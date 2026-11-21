const searchPage = require("./card-search");
const setDirectory = require("./set-directory");

module.exports = (req, res) => req.query?.view === "sets"
  ? setDirectory(req, res)
  : searchPage(req, res);
