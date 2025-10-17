// simple slug generator: converts text to lowercase-hyphen format

module.exports = (s) =>
  s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric with hyphen
    .replace(/(^-|-$)/g, "");    // remove leading/trailing hyphens
