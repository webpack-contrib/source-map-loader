const normalizeErrors = require("./normalizeErrors");

module.exports = (stats, shortError) =>
  normalizeErrors(stats.compilation.warnings.sort(), shortError);
