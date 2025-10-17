// Auth + Profile Controller (simplified)

'use strict';

const jwt = require('jsonwebtoken');
const { User } = require('../schema/user.model');
const { OtpCode } = require('../schema/otp.model');
const { issueTokens, rotateRefresh, revokeBySid, revokeAll } = require('../../../utils/jwt');
const { hash, verify } = require('../../../utils/crypto');
const { getTransportFromDb } = require('../../../config/smtp');
const { ok, err } = require('../../../utils/response');
const { saveWebp, deleteLocal } = require('../../../utils/image');

// ---------- Helpers ----------

const OTP_TTL_MS = 3 * 60 * 1000;
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 14);
const COOKIE_NAME_RT = 'rt';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
  maxAge: 1000 * 60 * 60 * 24 * REFRESH_TTL_DAYS,
};

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const setRefreshCookie = (res, token) => res.cookie(COOKIE_NAME_RT, token, COOKIE_OPTS);
const getBearer = (req) => (req.headers.authorization || '').split(' ')[1] || null;
const genOtp = () => String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
const norm = (v) => (typeof v === 'string' ? v.trim() : '');

// ===================================
// AUTH (OTP)
// ===================================

// Send OTP to email
exports.requestOtp = asyncHandler(async (req, res) => {
  const email = norm(req.body?.email);
  if (!email) return err(res, 400, 'email required');

  const code = genOtp();
  await OtpCode.deleteMany({ email });
  await OtpCode.create({
    email,
    codeHash: await hash(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  const t = await getTransportFromDb();
  await t.sendMail({
    to: email,
    subject: 'Your Login Code',
    html: `<p>Your OTP is <b>${code}</b> (valid 3 minutes).</p>`,
  });

  ok(res, { sent: true });
});

// Verify OTP and login
exports.verifyOtp = asyncHandler(async (req, res) => {
  const email = norm(req.body?.email);
  const code = norm(req.body?.code);
  if (!email || !code) return err(res, 400, 'email and code required');

  const entry = await OtpCode.findOne({ email });
  if (!entry || entry.expiresAt < new Date()) return err(res, 400, 'OTP expired');
  if (!(await verify(code, entry.codeHash))) return err(res, 400, 'Invalid OTP');

  let user = await User.findOne({ email });
  if (!user) user = await User.create({ email });

  const { access, refresh } = await issueTokens(user.id, 'user');
  setRefreshCookie(res, refresh);
  await OtpCode.deleteMany({ email });

  ok(res, { access });
});

// Rotate refresh and return new access
exports.refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME_RT];
  if (!token) return err(res, 401, 'missing refresh');

  const p = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  const { access, refresh } = await rotateRefresh(p.sid);

  setRefreshCookie(res, refresh);
  ok(res, { access });
});

// Revoke session and clear cookie
exports.logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME_RT];
  if (token) {
    try {
      const p = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      await revokeBySid(p.sid);
    } catch {
      // ignore bad token on logout
    }
  }
  res.clearCookie(COOKIE_NAME_RT, { path: '/' });
  ok(res, { loggedOut: true });
});

// Soft-delete user and revoke all tokens
exports.deleteAccount = asyncHandler(async (req, res) => {
  const token = getBearer(req);
  if (!token) return err(res, 401, 'missing token');

  const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  await User.findByIdAndUpdate(payload.sub, { isDeleted: true });
  await revokeAll(payload.sub, 'user');

  res.clearCookie(COOKIE_NAME_RT, { path: '/' });
  ok(res, { deleted: true });
});

// ===================================
// PROFILE CRUD
// ===================================

// Small generic field helpers
const readField = async (userId, field) => {
  const d = await User.findById(userId).select(field);
  return d?.[field] ?? null;
};

const createField = async (userId, field, value, existsMsg) => {
  const d = await User.findById(userId).select(field);
  if (d?.[field]) return { error: 409, msg: existsMsg };
  const u = await User.findByIdAndUpdate(userId, { [field]: value ?? '' }, { new: true }).select(field);
  return { value: u?.[field] ?? null };
};

const updateField = async (userId, field, value) => {
  const u = await User.findByIdAndUpdate(userId, { [field]: value }, { new: true }).select(field);
  return u?.[field] ?? null;
};

const deleteField = async (userId, field) => {
  const u = await User.findByIdAndUpdate(userId, { $set: { [field]: null } }, { new: true }).select(field);
  return u?.[field] ?? null;
};

// ---- NAME ----
exports.nameCreate = asyncHandler(async (req, res) => {
  const r = await createField(req.user.id, 'name', norm(req.body?.name), 'Name exists. Use PUT.');
  if (r.error) return err(res, r.error, r.msg);
  ok(res, { name: r.value });
});

exports.nameRead = asyncHandler(async (req, res) => {
  ok(res, { name: await readField(req.user.id, 'name') });
});

exports.nameUpdate = asyncHandler(async (req, res) => {
  ok(res, { name: await updateField(req.user.id, 'name', norm(req.body?.name)) });
});

exports.nameDelete = asyncHandler(async (req, res) => {
  ok(res, { name: await deleteField(req.user.id, 'name') });
});

// ---- MOBILE ----
exports.mobileCreate = asyncHandler(async (req, res) => {
  const r = await createField(req.user.id, 'mobile', norm(req.body?.mobile), 'Mobile exists. Use PUT.');
  if (r.error) return err(res, r.error, r.msg);
  ok(res, { mobile: r.value });
});

exports.mobileRead = asyncHandler(async (req, res) => {
  ok(res, { mobile: await readField(req.user.id, 'mobile') });
});

exports.mobileUpdate = asyncHandler(async (req, res) => {
  ok(res, { mobile: await updateField(req.user.id, 'mobile', norm(req.body?.mobile)) });
});

exports.mobileDelete = asyncHandler(async (req, res) => {
  ok(res, { mobile: await deleteField(req.user.id, 'mobile') });
});

// ---- ADDRESS ----
exports.addressCreate = asyncHandler(async (req, res) => {
  const r = await createField(req.user.id, 'address', norm(req.body?.address), 'Address exists. Use PUT.');
  if (r.error) return err(res, r.error, r.msg);
  ok(res, { address: r.value });
});

exports.addressRead = asyncHandler(async (req, res) => {
  ok(res, { address: await readField(req.user.id, 'address') });
});

exports.addressUpdate = asyncHandler(async (req, res) => {
  ok(res, { address: await updateField(req.user.id, 'address', norm(req.body?.address)) });
});

exports.addressDelete = asyncHandler(async (req, res) => {
  ok(res, { address: await deleteField(req.user.id, 'address') });
});

// ---- PICTURE ----
exports.picCreate = asyncHandler(async (req, res) => {
  if (!req.file) return err(res, 400, 'file required');

  const u = await User.findById(req.user.id).select('pictureUrl');
  if (u?.pictureUrl) return err(res, 409, 'Picture exists. Use PUT.');

  const out = await saveWebp(req.file.buffer, { area: 'users', entityId: req.user.id });
  const x = await User.findByIdAndUpdate(req.user.id, { pictureUrl: out.path }, { new: true }).select('pictureUrl');

  ok(res, { pictureUrl: x.pictureUrl });
});

exports.picRead = asyncHandler(async (req, res) => {
  ok(res, { pictureUrl: await readField(req.user.id, 'pictureUrl') });
});

exports.picUpdate = asyncHandler(async (req, res) => {
  if (!req.file) return err(res, 400, 'file required');

  const u = await User.findById(req.user.id).select('pictureUrl');
  if (u?.pictureUrl) {
    try {
      deleteLocal(u.pictureUrl);
    } catch {
      // ignore delete errors
    }
  }

  const out = await saveWebp(req.file.buffer, { area: 'users', entityId: req.user.id });
  const x = await User.findByIdAndUpdate(req.user.id, { pictureUrl: out.path }, { new: true }).select('pictureUrl');

  ok(res, { pictureUrl: x.pictureUrl });
});

exports.picDelete = asyncHandler(async (req, res) => {
  const u = await User.findById(req.user.id).select('pictureUrl');
  if (u?.pictureUrl) {
    try {
      deleteLocal(u.pictureUrl);
    } catch {
      // ignore delete errors
    }
  }

  const x = await User.findByIdAndUpdate(
    req.user.id,
    { $set: { pictureUrl: null } },
    { new: true }
  ).select('pictureUrl');

  ok(res, { pictureUrl: x.pictureUrl });
});
