// modules/auth/controller/admin.controller.js

'use strict';

/**
 * Admin Controller
 * - Session endpoints: login, refresh, logout
 * - Admin profile CRUD: name, picture
 * - Insights: usersCount, usersList
 */

const jwt = require('jsonwebtoken');
const { AdminProfile } = require('../schema/adminProfile.model');
const { User } = require('../schema/user.model');
const { issueTokens, rotateRefresh, revokeBySid } = require('../../../utils/jwt');
const { ok, err } = require('../../../utils/response');
const { saveWebp, deleteLocal } = require('../../../utils/image');

/* -------------------------------------------------------------------------- */
/*                                   CONFIG                                   */
/* -------------------------------------------------------------------------- */

const {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  JWT_REFRESH_SECRET,
  REFRESH_TTL_DAYS = '14',
  NODE_ENV,
  COOKIE_DOMAIN, // optional: set this in prod if you want a specific domain
} = process.env;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  // Fail fast on boot if critical admin creds are missing
  // (prevents ambiguous 500s at runtime)
  // eslint-disable-next-line no-console
  console.warn('[admin.controller] Missing ADMIN_EMAIL or ADMIN_PASSWORD in env.');
}
if (!JWT_REFRESH_SECRET) {
  // eslint-disable-next-line no-console
  console.warn('[admin.controller] Missing JWT_REFRESH_SECRET in env.');
}

const isProduction = NODE_ENV === 'production';

/* -------------------------------------------------------------------------- */
/*                                   UTILS                                    */
/* -------------------------------------------------------------------------- */

// Standardized async handler to avoid repetitive try/catch
const asyncHandler =
  (fn) =>
  async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (e) {
      next(e);
    }
  };

// Basic string guard
const asString = (val, fallback = '') =>
  typeof val === 'string' ? val : fallback;

// Normalize/trim a name; keep it simple without extra deps
const normalizeName = (val) => asString(val).trim();

// Clamp helper
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// Cookie setter for refresh token
const setRefreshCookie = (res, token) => {
  // Secure cookies should generally be true in prod (HTTPS).
  // SameSite 'strict' reduces CSRF surface for refresh token.
  const maxAge =
    1000 * 60 * 60 * 24 * Number.isFinite(+REFRESH_TTL_DAYS)
      ? 1000 * 60 * 60 * 24 * +REFRESH_TTL_DAYS
      : 1000 * 60 * 60 * 24 * 14;

  const cookieOpts = {
    httpOnly: true,
    secure: isProduction, // allow local dev over http
    sameSite: 'strict',
    path: '/',
    maxAge,
  };

  if (COOKIE_DOMAIN) cookieOpts.domain = COOKIE_DOMAIN;

  res.cookie('rt', token, cookieOpts);
};

const clearRefreshCookie = (res) => {
  const opts = { path: '/' };
  if (COOKIE_DOMAIN) opts.domain = COOKIE_DOMAIN;
  res.clearCookie('rt', opts);
};

/* -------------------------------------------------------------------------- */
/*                                  SESSIONS                                  */
/* -------------------------------------------------------------------------- */

exports.login = asyncHandler(async (req, res) => {
  const email = asString(req.body?.email).toLowerCase().trim();
  const password = asString(req.body?.password);

  if (!email || !password) return err(res, 400, 'Email and password are required');

  // Single-admin check against env
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return err(res, 401, 'Invalid credentials');
  }

  const { access, refresh } = await issueTokens(email, 'admin');

  // Ensure profile exists for the admin
  await AdminProfile.updateOne(
    { email },
    { $setOnInsert: { email } },
    { upsert: true }
  );

  setRefreshCookie(res, refresh);
  return ok(res, { access });
});

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
  return ok(res, { access });
});

exports.logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.rt;

  if (token) {
    try {
      const p = jwt.verify(token, JWT_REFRESH_SECRET);
      await revokeBySid(p.sid);
    } catch {
      // token invalid/expired — best-effort revoke; continue to clear cookie
    }
  }

  clearRefreshCookie(res);
  return ok(res, { loggedOut: true });
});

/* -------------------------------------------------------------------------- */
/*                              PROFILE — NAME CRUD                           */
/* -------------------------------------------------------------------------- */

exports.nameCreate = asyncHandler(async (req, res) => {
  const email = ADMIN_EMAIL;
  const existing = await AdminProfile.findOne({ email }).select('name').lean();

  if (existing?.name) {
    return err(res, 409, 'Name already exists. Use PUT to replace.');
  }

  const initialName = normalizeName(req.body?.name);

  const doc = await AdminProfile.findOneAndUpdate(
    { email },
    { $set: { name: initialName || null } },
    { new: true, upsert: true, projection: { name: 1 } }
  );

  return ok(res, { name: doc?.name ?? null });
});

exports.nameRead = asyncHandler(async (_req, res) => {
  const prof = await AdminProfile.findOne({ email: ADMIN_EMAIL })
    .select('name')
    .lean();
  return ok(res, { name: prof?.name ?? null });
});

exports.nameUpdate = asyncHandler(async (req, res) => {
  const name = normalizeName(req.body?.name);

  const doc = await AdminProfile.findOneAndUpdate(
    { email: ADMIN_EMAIL },
    { $set: { name: name || null } },
    { new: true, upsert: true, projection: { name: 1 } }
  );

  return ok(res, { name: doc?.name ?? null });
});

exports.nameDelete = asyncHandler(async (_req, res) => {
  const doc = await AdminProfile.findOneAndUpdate(
    { email: ADMIN_EMAIL },
    { $set: { name: null } },
    { new: true, upsert: true, projection: { name: 1 } }
  );

  return ok(res, { name: doc?.name ?? null });
});

/* -------------------------------------------------------------------------- */
/*                            PROFILE — PICTURE CRUD                          */
/* -------------------------------------------------------------------------- */

exports.picCreate = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) return err(res, 400, 'Image file is required');

  const email = ADMIN_EMAIL;
  const prof = await AdminProfile.findOne({ email }).select('pictureUrl').lean();

  if (prof?.pictureUrl) {
    return err(res, 409, 'Picture already exists. Use PUT to replace.');
  }

  const out = await saveWebp(req.file.buffer, { area: 'admins', entityId: 'root' });

  const doc = await AdminProfile.findOneAndUpdate(
    { email },
    { $set: { pictureUrl: out.path } },
    { new: true, upsert: true, projection: { pictureUrl: 1 } }
  );

  return ok(res, { pictureUrl: doc?.pictureUrl ?? null });
});

exports.picRead = asyncHandler(async (_req, res) => {
  const prof = await AdminProfile.findOne({ email: ADMIN_EMAIL })
    .select('pictureUrl')
    .lean();
  return ok(res, { pictureUrl: prof?.pictureUrl ?? null });
});

exports.picUpdate = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) return err(res, 400, 'Image file is required');

  const email = ADMIN_EMAIL;
  const prof = await AdminProfile.findOne({ email }).select('pictureUrl').lean();

  if (prof?.pictureUrl) {
    // Best-effort cleanup of old local file
    try {
      deleteLocal(prof.pictureUrl);
    } catch {
      // Swallow file delete errors to avoid blocking update
    }
  }

  const out = await saveWebp(req.file.buffer, { area: 'admins', entityId: 'root' });

  const doc = await AdminProfile.findOneAndUpdate(
    { email },
    { $set: { pictureUrl: out.path } },
    { new: true, upsert: true, projection: { pictureUrl: 1 } }
  );

  return ok(res, { pictureUrl: doc?.pictureUrl ?? null });
});

exports.picDelete = asyncHandler(async (_req, res) => {
  const email = ADMIN_EMAIL;
  const prof = await AdminProfile.findOne({ email }).select('pictureUrl').lean();

  if (prof?.pictureUrl) {
    try {
      deleteLocal(prof.pictureUrl);
    } catch {
      // non-fatal
    }
  }

  const doc = await AdminProfile.findOneAndUpdate(
    { email },
    { $set: { pictureUrl: null } },
    { new: true, upsert: true, projection: { pictureUrl: 1 } }
  );

  return ok(res, { pictureUrl: doc?.pictureUrl ?? null });
});

/* -------------------------------------------------------------------------- */
/*                                   INSIGHTS                                 */
/* -------------------------------------------------------------------------- */

exports.usersCount = asyncHandler(async (_req, res) => {
  const n = await User.countDocuments({ isDeleted: false });
  return ok(res, { count: n });
});

exports.usersList = asyncHandler(async (req, res) => {
  const pageRaw = Number(req.query?.page);
  const pageSizeRaw = Number(req.query?.pageSize);

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = clamp(Number.isFinite(pageSizeRaw) ? Math.floor(pageSizeRaw) : 20, 1, 100);

  const users = await User.find({ isDeleted: false })
    .select('name email mobile address pictureUrl createdAt')
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();

  return ok(res, { items: users }, { page, pageSize });
});
