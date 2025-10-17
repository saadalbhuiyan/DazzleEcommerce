'use strict';

/**
 * Admin Controller
 * - Auth: login / refresh / logout
 * - Profile: name & picture CRUD
 * - Insights: users count & list
 */

const jwt = require('jsonwebtoken');
const { AdminProfile } = require('../schema/adminProfile.model');
const { User } = require('../schema/user.model');
const { issueTokens, rotateRefresh, revokeBySid } = require('../../../utils/jwt');
const { ok, err } = require('../../../utils/response');
const { saveWebp, deleteLocal } = require('../../../utils/image');

const {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  JWT_REFRESH_SECRET,
  REFRESH_TTL_DAYS = '14',
  NODE_ENV,
  COOKIE_DOMAIN,
} = process.env;

const IS_PROD = NODE_ENV === 'production';

// ---------- Small helpers ----------

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const asString = (v, fallback = '') => (typeof v === 'string' ? v : fallback);
const normalize = (v) => asString(v).trim();
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const parseRefreshDays = () => {
  const n = Number(REFRESH_TTL_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 14;
};

const setRefreshCookie = (res, token) => {
  const days = parseRefreshDays();
  const options = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * days,
  };
  if (COOKIE_DOMAIN) options.domain = COOKIE_DOMAIN;
  res.cookie('rt', token, options);
};

const clearRefreshCookie = (res) => {
  const options = { path: '/' };
  if (COOKIE_DOMAIN) options.domain = COOKIE_DOMAIN;
  res.clearCookie('rt', options);
};

// ===================================
// Sessions
// ===================================

// POST /admin/login
exports.login = asyncHandler(async (req, res) => {
  const email = normalize(req.body?.email).toLowerCase();
  const password = asString(req.body?.password);

  if (!email || !password) return err(res, 400, 'Email and password are required');
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) return err(res, 401, 'Invalid credentials');

  const { access, refresh } = await issueTokens(email, 'admin');

  // Ensure profile exists
  await AdminProfile.updateOne({ email }, { $setOnInsert: { email } }, { upsert: true });

  setRefreshCookie(res, refresh);
  ok(res, { access });
});

// POST /admin/refresh
exports.refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.rt;
  if (!token) return err(res, 401, 'Missing refresh token');

  let payload;
  try {
    payload = jwt.verify(token, JWT_REFRESH_SECRET);
  } catch {
    return err(res, 401, 'Invalid or expired refresh token');
  }

  const { access, refresh } = await rotateRefresh(payload.sid);
  setRefreshCookie(res, refresh);
  ok(res, { access });
});

// POST /admin/logout
exports.logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.rt;

  if (token) {
    try {
      const p = jwt.verify(token, JWT_REFRESH_SECRET);
      await revokeBySid(p.sid);
    } catch {
      // ignore token errors on logout
    }
  }

  clearRefreshCookie(res);
  ok(res, { loggedOut: true });
});

// ===================================
// Profile: Name
// ===================================

// POST /admin/profile/name
exports.nameCreate = asyncHandler(async (req, res) => {
  const email = ADMIN_EMAIL;

  const existing = await AdminProfile.findOne({ email }).select('name').lean();
  if (existing?.name) return err(res, 409, 'Name already exists. Use PUT to replace.');

  const name = normalize(req.body?.name) || null;

  const doc = await AdminProfile.findOneAndUpdate(
    { email },
    { $set: { name } },
    { new: true, upsert: true, projection: { name: 1 } }
  );

  ok(res, { name: doc?.name ?? null });
});

// GET /admin/profile/name
exports.nameRead = asyncHandler(async (_req, res) => {
  const prof = await AdminProfile.findOne({ email: ADMIN_EMAIL }).select('name').lean();
  ok(res, { name: prof?.name ?? null });
});

// PUT /admin/profile/name
exports.nameUpdate = asyncHandler(async (req, res) => {
  const name = normalize(req.body?.name) || null;

  const doc = await AdminProfile.findOneAndUpdate(
    { email: ADMIN_EMAIL },
    { $set: { name } },
    { new: true, upsert: true, projection: { name: 1 } }
  );

  ok(res, { name: doc?.name ?? null });
});

// DELETE /admin/profile/name
exports.nameDelete = asyncHandler(async (_req, res) => {
  const doc = await AdminProfile.findOneAndUpdate(
    { email: ADMIN_EMAIL },
    { $set: { name: null } },
    { new: true, upsert: true, projection: { name: 1 } }
  );

  ok(res, { name: doc?.name ?? null });
});

// ===================================
// Profile: Picture
// ===================================

// POST /admin/profile/picture
exports.picCreate = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) return err(res, 400, 'Image file is required');

  const email = ADMIN_EMAIL;

  const prof = await AdminProfile.findOne({ email }).select('pictureUrl').lean();
  if (prof?.pictureUrl) return err(res, 409, 'Picture already exists. Use PUT to replace.');

  const out = await saveWebp(req.file.buffer, { area: 'admins', entityId: 'root' });

  const doc = await AdminProfile.findOneAndUpdate(
    { email },
    { $set: { pictureUrl: out.path } },
    { new: true, upsert: true, projection: { pictureUrl: 1 } }
  );

  ok(res, { pictureUrl: doc?.pictureUrl ?? null });
});

// GET /admin/profile/picture
exports.picRead = asyncHandler(async (_req, res) => {
  const prof = await AdminProfile.findOne({ email: ADMIN_EMAIL }).select('pictureUrl').lean();
  ok(res, { pictureUrl: prof?.pictureUrl ?? null });
});

// PUT /admin/profile/picture
exports.picUpdate = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) return err(res, 400, 'Image file is required');

  const email = ADMIN_EMAIL;

  const prof = await AdminProfile.findOne({ email }).select('pictureUrl').lean();
  if (prof?.pictureUrl) {
    try {
      deleteLocal(prof.pictureUrl);
    } catch {
      // ignore delete errors
    }
  }

  const out = await saveWebp(req.file.buffer, { area: 'admins', entityId: 'root' });

  const doc = await AdminProfile.findOneAndUpdate(
    { email },
    { $set: { pictureUrl: out.path } },
    { new: true, upsert: true, projection: { pictureUrl: 1 } }
  );

  ok(res, { pictureUrl: doc?.pictureUrl ?? null });
});

// DELETE /admin/profile/picture
exports.picDelete = asyncHandler(async (_req, res) => {
  const email = ADMIN_EMAIL;

  const prof = await AdminProfile.findOne({ email }).select('pictureUrl').lean();
  if (prof?.pictureUrl) {
    try {
      deleteLocal(prof.pictureUrl);
    } catch {
      // ignore delete errors
    }
  }

  const doc = await AdminProfile.findOneAndUpdate(
    { email },
    { $set: { pictureUrl: null } },
    { new: true, upsert: true, projection: { pictureUrl: 1 } }
  );

  ok(res, { pictureUrl: doc?.pictureUrl ?? null });
});

// ===================================
// Insights
// ===================================

// GET /admin/insights/users/count
exports.usersCount = asyncHandler(async (_req, res) => {
  const count = await User.countDocuments({ isDeleted: false });
  ok(res, { count });
});

// GET /admin/insights/users
exports.usersList = asyncHandler(async (req, res) => {
  const page = Math.max(1, Math.floor(Number(req.query?.page) || 1));
  const pageSize = clamp(Math.floor(Number(req.query?.pageSize) || 20), 1, 100);

  const items = await User.find({ isDeleted: false })
    .select('name email mobile address pictureUrl createdAt')
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();

  ok(res, { items }, { page, pageSize });
});
