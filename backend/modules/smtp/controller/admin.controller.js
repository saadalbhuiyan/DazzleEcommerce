// modules/smtp/controller/admin.controller.js

'use strict';

const { SmtpConfig } = require('../schema/smtp.model');
const { encrypt } = require('../../../utils/crypto');
const { ok, err } = require('../../../utils/response');

// ---------- Helpers ----------
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// ===================================
// SMTP Config (Admin)
// ===================================

// Create SMTP config
exports.create = asyncHandler(async (req, res) => {
  const { host, port, username, password } = req.body || {};
  if (!host || !port || !username || !password)
    return err(res, 400, 'All fields required');

  const cfg = await SmtpConfig.create({
    host,
    port,
    username,
    passwordEnc: encrypt(password),
    createdBy: process.env.ADMIN_EMAIL,
  });

  ok(res, { id: cfg.id });
});

// Read latest SMTP config
exports.read = asyncHandler(async (_req, res) => {
  const cfg = await SmtpConfig.findOne().sort({ updatedAt: -1 });
  if (!cfg) return ok(res, { config: null });

  ok(res, {
    config: {
      host: cfg.host,
      port: cfg.port,
      username: cfg.username,
      password: '****',
    },
  });
});

// Update SMTP config
exports.update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const patch = { ...req.body };

  if (patch.password) {
    patch.passwordEnc = encrypt(patch.password);
    delete patch.password;
  }

  patch.updatedBy = process.env.ADMIN_EMAIL;

  await SmtpConfig.findByIdAndUpdate(id, patch);
  ok(res, { updated: true });
});

// Delete SMTP config
exports.remove = asyncHandler(async (req, res) => {
  await SmtpConfig.findByIdAndDelete(req.params.id);
  ok(res, { deleted: true });
});
