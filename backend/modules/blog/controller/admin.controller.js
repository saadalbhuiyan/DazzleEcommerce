// modules/blog/controller/admin.controller.js

'use strict';

const mongoose = require('mongoose');
const { ok, err } = require('../../../utils/response');
const { saveWebp, deleteLocal } = require('../../../utils/image');
const Blog = require('../schema/blog.model');
const BlogCategory = require('../schema/blogCategory.model');

// ---------- Helpers ----------

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const toObjId = (id) =>
  mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;

// ===================================
// Categories (Admin)
// ===================================

// Create category
exports.categoryCreate = asyncHandler(async (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) return err(res, 400, 'name required');

  const slug = slugify(name);
  const exists = await BlogCategory.findOne({ slug });
  if (exists) return err(res, 409, 'category exists');

  const doc = await BlogCategory.create({ name, slug, isActive: true });
  ok(res, { id: doc.id, name: doc.name, slug: doc.slug, isActive: doc.isActive });
});

// List categories
exports.categoryList = asyncHandler(async (_req, res) => {
  const items = await BlogCategory.find({}).sort({ createdAt: -1 });
  ok(res, { items });
});

// Update category (slug immutable)
exports.categoryUpdate = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const patch = {};
  if (typeof req.body?.name === 'string') patch.name = req.body.name;
  if (typeof req.body?.isActive === 'boolean') patch.isActive = req.body.isActive;

  const doc = await BlogCategory.findByIdAndUpdate(id, patch, { new: true });
  if (!doc) return err(res, 404, 'not found');

  ok(res, { id: doc.id, name: doc.name, slug: doc.slug, isActive: doc.isActive });
});

// Remove category (only if unused)
exports.categoryRemove = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const inUse = await Blog.exists({ categoryId: id });
  if (inUse) return err(res, 409, 'category has blogs; reassign or delete blogs first');

  const del = await BlogCategory.findByIdAndDelete(id);
  if (!del) return err(res, 404, 'not found');

  ok(res, { deleted: true });
});

// ===================================
// Blogs (Admin)
// ===================================

// Create blog
exports.blogCreate = asyncHandler(async (req, res) => {
  const title = (req.body?.title || '').trim();
  const descriptionHtml = (req.body?.descriptionHtml || '').trim();
  const categoryId = (req.body?.categoryId || '').trim();

  if (!title || !descriptionHtml || !categoryId) {
    return err(res, 400, 'title, descriptionHtml, categoryId required');
  }
  if (!req.file) return err(res, 400, 'hero image (file) required');

  const cat = await BlogCategory.findById(categoryId);
  if (!cat) return err(res, 400, 'invalid categoryId');

  // unique slug
  const slugBase = slugify(title);
  let slug = slugBase;
  let i = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Blog.exists({ slug })) slug = `${slugBase}-${i++}`;

  const out = await saveWebp(req.file.buffer, { area: 'blogs', entityId: slug });

  const doc = await Blog.create({
    title,
    slug,
    descriptionHtml,
    heroImageUrl: out.path,
    categoryId: cat._id,
    isActive: true,
    publishedAt: new Date(),
  });

  ok(res, { id: doc.id, slug: doc.slug });
});

// List blogs (paged)
exports.blogList = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.min(100, parseInt(req.query.pageSize || '20', 10));

  const items = await Blog.find({})
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize);

  ok(res, { items }, { page, pageSize });
});

// Read blog by id
exports.blogRead = asyncHandler(async (req, res) => {
  const id = toObjId(req.params.id);
  if (!id) return err(res, 400, 'invalid id');

  const doc = await Blog.findById(id);
  if (!doc) return err(res, 404, 'not found');

  ok(res, doc);
});

// Update blog (slug immutable)
exports.blogUpdate = asyncHandler(async (req, res) => {
  const id = toObjId(req.params.id);
  if (!id) return err(res, 400, 'invalid id');

  const patch = {};
  if (typeof req.body?.title === 'string') patch.title = req.body.title; // slug immutable
  if (typeof req.body?.descriptionHtml === 'string') patch.descriptionHtml = req.body.descriptionHtml;

  if (typeof req.body?.categoryId === 'string') {
    const cat = await BlogCategory.findById(req.body.categoryId);
    if (!cat) return err(res, 400, 'invalid categoryId');
    patch.categoryId = cat._id;
  }

  if (req.file) {
    const existing = await Blog.findById(id).select('heroImageUrl slug');
    if (!existing) return err(res, 404, 'not found');

    if (existing.heroImageUrl) deleteLocal(existing.heroImageUrl);

    const out = await saveWebp(req.file.buffer, { area: 'blogs', entityId: existing.slug });
    patch.heroImageUrl = out.path;
  }

  const doc = await Blog.findByIdAndUpdate(id, patch, { new: true });
  if (!doc) return err(res, 404, 'not found');

  ok(res, { id: doc.id, slug: doc.slug });
});

// Toggle blog active status
exports.blogToggleStatus = asyncHandler(async (req, res) => {
  const id = toObjId(req.params.id);
  if (!id) return err(res, 400, 'invalid id');

  const doc = await Blog.findById(id).select('isActive');
  if (!doc) return err(res, 404, 'not found');

  doc.isActive = !doc.isActive;
  await doc.save();

  ok(res, { id: doc.id, isActive: doc.isActive });
});

// Remove blog (and hero image if any)
exports.blogRemove = asyncHandler(async (req, res) => {
  const id = toObjId(req.params.id);
  if (!id) return err(res, 400, 'invalid id');

  const doc = await Blog.findByIdAndDelete(id);
  if (!doc) return err(res, 404, 'not found');

  if (doc.heroImageUrl) deleteLocal(doc.heroImageUrl);

  ok(res, { deleted: true });
});

// Search blogs (text > regex fallback)
exports.blogSearch = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return ok(res, { items: [] });

  let items;
  try {
    items = await Blog.find({ $text: { $search: q } }).sort({ score: { $meta: 'textScore' } });
  } catch {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    items = await Blog.find({ $or: [{ title: rx }, { descriptionHtml: rx }] }).sort({ createdAt: -1 });
  }

  ok(res, { items });
});
