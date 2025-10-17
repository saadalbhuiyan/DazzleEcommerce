// blog schema

const mongoose = require("mongoose");

const BlogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    descriptionHtml: { type: String, required: true },
    heroImageUrl: { type: String, required: true },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlogCategory",
      required: true,
    },
    isActive: { type: Boolean, default: true },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// enable text search on title and description
BlogSchema.index({ title: "text", descriptionHtml: "text" });

module.exports = mongoose.model("Blog", BlogSchema);
