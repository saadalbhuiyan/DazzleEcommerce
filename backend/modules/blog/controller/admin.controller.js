// modules/blog/controller/admin.controller.js
const mongoose = require("mongoose");
const { ok, err } = require("../../../utils/response");
const { saveWebp, deleteLocal } = require("../../../utils/image");
const Blog = require("../schema/blog.model");
const BlogCategory = require("../schema/blogCategory.model");

// helpers
const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const toObjId = (id) => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null);

/* ===========================
 * Categories (Admin)
 * =========================== */
exports.categoryCreate = async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name) return err(res, 400, "name required");
    const slug = slugify(name);
    const exists = await BlogCategory.findOne({ slug });
    if (exists) return err(res, 409, "category exists");
    const doc = await BlogCategory.create({ name, slug, isActive: true });
    ok(res, { id: doc.id, name: doc.name, slug: doc.slug, isActive: doc.isActive });
  } catch (e) { next(e); }
};

exports.categoryList = async (_req, res, next) => {
  try {
    const items = await BlogCategory.find({}).sort({ createdAt: -1 });
    ok(res, { items });
  } catch (e) { next(e); }
};

exports.categoryUpdate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const patch = {};
    if (typeof req.body?.name === "string") patch.name = req.body.name; // slug immutable
    if (typeof req.body?.isActive === "boolean") patch.isActive = req.body.isActive;

    const doc = await BlogCategory.findByIdAndUpdate(id, patch, { new: true });
    if (!doc) return err(res, 404, "not found");
    ok(res, { id: doc.id, name: doc.name, slug: doc.slug, isActive: doc.isActive });
  } catch (e) { next(e); }
};

exports.categoryRemove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const inUse = await Blog.exists({ categoryId: id });
    if (inUse) return err(res, 409, "category has blogs; reassign or delete blogs first");
    const del = await BlogCategory.findByIdAndDelete(id);
    if (!del) return err(res, 404, "not found");
    ok(res, { deleted: true });
  } catch (e) { next(e); }
};

/* ===========================
 * Blogs (Admin)
 * =========================== */
exports.blogCreate = async (req, res, next) => {
  try {
    const { title, descriptionHtml, categoryId } = req.body || {};
    if (!title || !descriptionHtml || !categoryId) return err(res, 400, "title, descriptionHtml, categoryId required");
    if (!req.file) return err(res, 400, "hero image (file) required");

    const cat = await BlogCategory.findById(categoryId);
    if (!cat) return err(res, 400, "invalid categoryId");

    const slugBase = slugify(title);
    let slug = slugBase, i = 1;
    while (await Blog.exists({ slug })) slug = `${slugBase}-${i++}`;

    const out = await saveWebp(req.file.buffer, { area: "blogs", entityId: slug });
    const doc = await Blog.create({
      title,
      slug,
      descriptionHtml,
      heroImageUrl: out.path,
      categoryId: cat._id,
      isActive: true,
      publishedAt: new Date()
    });

    ok(res, { id: doc.id, slug: doc.slug });
  } catch (e) { next(e); }
};

exports.blogList = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const pageSize = Math.min(100, parseInt(req.query.pageSize || "20", 10));
    const items = await Blog.find({}).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize);
    ok(res, { items }, { page, pageSize });
  } catch (e) { next(e); }
};

exports.blogRead = async (req, res, next) => {
  try {
    const id = toObjId(req.params.id);
    if (!id) return err(res, 400, "invalid id");
    const doc = await Blog.findById(id);
    if (!doc) return err(res, 404, "not found");
    ok(res, doc);
  } catch (e) { next(e); }
};

exports.blogUpdate = async (req, res, next) => {
  try {
    const id = toObjId(req.params.id);
    if (!id) return err(res, 400, "invalid id");

    const patch = {};
    if (typeof req.body?.title === "string") patch.title = req.body.title; // slug immutable
    if (typeof req.body?.descriptionHtml === "string") patch.descriptionHtml = req.body.descriptionHtml;
    if (typeof req.body?.categoryId === "string") {
      const cat = await BlogCategory.findById(req.body.categoryId);
      if (!cat) return err(res, 400, "invalid categoryId");
      patch.categoryId = cat._id;
    }

    if (req.file) {
      const existing = await Blog.findById(id).select("heroImageUrl slug");
      if (!existing) return err(res, 404, "not found");
      if (existing.heroImageUrl) deleteLocal(existing.heroImageUrl);
      const out = await saveWebp(req.file.buffer, { area: "blogs", entityId: existing.slug });
      patch.heroImageUrl = out.path;
    }

    const doc = await Blog.findByIdAndUpdate(id, patch, { new: true });
    if (!doc) return err(res, 404, "not found");
    ok(res, { id: doc.id, slug: doc.slug });
  } catch (e) { next(e); }
};

exports.blogToggleStatus = async (req, res, next) => {
  try {
    const id = toObjId(req.params.id);
    if (!id) return err(res, 400, "invalid id");
    const doc = await Blog.findById(id).select("isActive");
    if (!doc) return err(res, 404, "not found");
    doc.isActive = !doc.isActive;
    await doc.save();
    ok(res, { id: doc.id, isActive: doc.isActive });
  } catch (e) { next(e); }
};

exports.blogRemove = async (req, res, next) => {
  try {
    const id = toObjId(req.params.id);
    if (!id) return err(res, 400, "invalid id");
    const doc = await Blog.findByIdAndDelete(id);
    if (!doc) return err(res, 404, "not found");
    if (doc.heroImageUrl) deleteLocal(doc.heroImageUrl);
    ok(res, { deleted: true });
  } catch (e) { next(e); }
};

exports.blogSearch = async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return ok(res, { items: [] });

    // prefer $text, fallback to regex so it works even before index builds
    let items;
    try {
      items = await Blog.find({ $text: { $search: q } }).sort({ score: { $meta: "textScore" } });
    } catch {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      items = await Blog.find({ $or: [{ title: rx }, { descriptionHtml: rx }] }).sort({ createdAt: -1 });
    }
    ok(res, { items });
  } catch (e) { next(e); }
};
