// modules/blog/controller/public.controller.js

'use strict';

const { ok, err } = require('../../../utils/response');
const Blog = require('../schema/blog.model');
const BlogCategory = require('../schema/blogCategory.model');

// ---------- Helpers ----------

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const norm = (v) => (typeof v === 'string' ? v.trim() : '');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ===================================
// Public Endpoints
// ===================================

// List all active blogs (newest first by default)
exports.publicList = asyncHandler(async (req, res) => {
  const sortKey = norm(req.query.sort).toLowerCase() === 'old' ? 1 : -1;
  const items = await Blog.find({ isActive: true })
    .sort({ publishedAt: sortKey })
    .select('title slug heroImageUrl publishedAt');

  ok(res, { items });
});

// Search active blogs (text index preferred, regex fallback)
exports.publicSearch = asyncHandler(async (req, res) => {
  const q = norm(req.query.q);
  if (!q) return ok(res, { items: [] });

  let items;
  try {
    items = await Blog.find({ isActive: true, $text: { $search: q } })
      .sort({ score: { $meta: 'textScore' } })
      .select('title slug heroImageUrl publishedAt');
  } catch {
    const rx = new RegExp(escapeRegex(q), 'i');
    items = await Blog.find({ isActive: true, $or: [{ title: rx }, { descriptionHtml: rx }] })
      .sort({ publishedAt: -1 })
      .select('title slug heroImageUrl publishedAt');
  }

  ok(res, { items });
});

// List active blogs by active category slug
exports.publicByCategory = asyncHandler(async (req, res) => {
  const slug = norm(req.params.slug);
  const cat = await BlogCategory.findOne({ slug, isActive: true }).select('_id');
  if (!cat) return ok(res, { items: [] });

  const items = await Blog.find({ isActive: true, categoryId: cat._id })
    .sort({ publishedAt: -1 })
    .select('title slug heroImageUrl publishedAt');

  ok(res, { items });
});

// Read a single active blog by slug
exports.publicRead = asyncHandler(async (req, res) => {
  const slug = norm(req.params.slug);
  const doc = await Blog.findOne({ slug, isActive: true });
  if (!doc) return err(res, 404, 'not found');
  ok(res, doc);
});
