const { SmtpConfig } = require("../schema/smtp.model");
const { encrypt } = require("../../../utils/crypto");
const { ok, err } = require("../../../utils/response");

exports.create = async (req, res, next) => { try {
  const { host, port, username, password } = req.body;
  if (!host || !port || !username || !password) return err(res, 400, "All fields required");
  const cfg = await SmtpConfig.create({ host, port, username, passwordEnc: encrypt(password), createdBy: process.env.ADMIN_EMAIL });
  ok(res, { id: cfg.id });
} catch (e) { next(e); }};

exports.read = async (_req, res, next) => { try {
  const cfg = await SmtpConfig.findOne().sort({ updatedAt: -1 });
  if (!cfg) return ok(res, { config: null });
  ok(res, { config: { host: cfg.host, port: cfg.port, username: cfg.username, password: "****" } });
} catch (e) { next(e); }};

exports.update = async (req, res, next) => { try {
  const id = req.params.id;
  const patch = { ...req.body };
  if (patch.password) { patch.passwordEnc = encrypt(patch.password); delete patch.password; }
  patch.updatedBy = process.env.ADMIN_EMAIL;
  await SmtpConfig.findByIdAndUpdate(id, patch);
  ok(res, { updated: true });
} catch (e) { next(e); }};

exports.remove = async (req, res, next) => { try {
  await SmtpConfig.findByIdAndDelete(req.params.id);
  ok(res, { deleted: true });
} catch (e) { next(e); }};
