import normalizeErrors from "./normalizeErrors";

export default (stats, shortError) =>
  normalizeErrors(stats.compilation.warnings.sort(), shortError);
