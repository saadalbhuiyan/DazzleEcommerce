// modules/blog/routes/admin.routes.js
const r = require("express").Router();
const adminAuth = require("../../../middleware/authAdmin");
const { uploadAnyImage } = require("../../../middleware/uploadFile");

// use your admin controller (contains both blog & category handlers)
const admin = require("../controller/admin.controller");

// --- categories FIRST (avoid '/:id' capture) ---
r.post("/categories", adminAuth, admin.categoryCreate);
r.get("/categories", adminAuth, admin.categoryList);
r.put("/categories/:id", adminAuth, admin.categoryUpdate);
r.delete("/categories/:id", adminAuth, admin.categoryRemove);

// --- blog search BEFORE :id ---
r.get("/search", adminAuth, admin.blogSearch);

// --- blogs ---
r.post("/", adminAuth, uploadAnyImage, admin.blogCreate);
r.get("/", adminAuth, admin.blogList);
r.get("/:id", adminAuth, admin.blogRead);
r.put("/:id", adminAuth, uploadAnyImage, admin.blogUpdate);
r.patch("/:id/status", adminAuth, admin.blogToggleStatus);
r.delete("/:id", adminAuth, admin.blogRemove);

module.exports = r;
