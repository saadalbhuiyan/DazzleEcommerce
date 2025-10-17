// modules/blog/controller/public.controller.js
const { ok, err } = require("../../../utils/response");
const Blog = require("../schema/blog.model");
const BlogCategory = require("../schema/blogCategory.model");

exports.publicList = async (req, res, next) => {
  try {
    const sort = (req.query.sort || "new").toLowerCase() === "old" ? { publishedAt: 1 } : { publishedAt: -1 };
    const items = await Blog.find({ isActive: true }).sort(sort).select("title slug heroImageUrl publishedAt");
    ok(res, { items });
  } catch (e) { next(e); }
};

exports.publicSearch = async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return ok(res, { items: [] });
    let items;
    try {
      items = await Blog.find({ isActive: true, $text: { $search: q } })
        .sort({ score: { $meta: "textScore" } })
        .select("title slug heroImageUrl publishedAt");
    } catch {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      items = await Blog.find({ isActive: true, $or: [{ title: rx }, { descriptionHtml: rx }] })
        .sort({ publishedAt: -1 })
        .select("title slug heroImageUrl publishedAt");
    }
    ok(res, { items });
  } catch (e) { next(e); }
};

exports.publicByCategory = async (req, res, next) => {
  try {
    const slug = (req.params.slug || "").trim();
    const cat = await BlogCategory.findOne({ slug, isActive: true }).select("_id");
    if (!cat) return ok(res, { items: [] });
    const items = await Blog.find({ isActive: true, categoryId: cat._id })
      .sort({ publishedAt: -1 })
      .select("title slug heroImageUrl publishedAt");
    ok(res, { items });
  } catch (e) { next(e); }
};

exports.publicRead = async (req, res, next) => {
  try {
    const slug = (req.params.slug || "").trim();
    const doc = await Blog.findOne({ slug, isActive: true });
    if (!doc) return err(res, 404, "not found");
    ok(res, doc);
  } catch (e) { next(e); }
};
