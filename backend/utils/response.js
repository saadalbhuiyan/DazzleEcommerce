// simple response helpers

const ok = (res, data = {}, meta = {}) => {
  res.json({ ok: true, data, meta });
};

const err = (res, code = 400, message = "error", details) => {
  res.status(code).json({ ok: false, message, details });
};

module.exports = { ok, err };
