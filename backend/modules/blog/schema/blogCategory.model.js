// blog category schema

const { Schema, model, models } = require("mongoose");

const BlogCategorySchema = new Schema(
  {
    name: { type: String, unique: true, required: true },
    slug: { type: String, unique: true, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// reuse model if it already exists (prevents overwrite errors)
const BlogCategory =
  models.BlogCategory || model("BlogCategory", BlogCategorySchema);

module.exports = BlogCategory;
