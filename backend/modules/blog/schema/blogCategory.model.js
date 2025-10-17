// modules/blog/schema/blogCategory.model.js
const { Schema, model, models } = require("mongoose");

const BlogCategorySchema = new Schema(
  {
    name: { type: String, unique: true, required: true },
    slug: { type: String, unique: true, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Prevent OverwriteModelError when hot reloading
const BlogCategory = models.BlogCategory || model("BlogCategory", BlogCategorySchema);

module.exports = BlogCategory; 
