const express = require("express");
const router = express.Router();

const adminAuth = require("../../../middleware/authAdmin");
const { uploadAnyImage } = require("../../../middleware/uploadFile");
const controller = require("../controller/admin.controller");

// Category routes
router.post("/categories", adminAuth, controller.categoryCreate);
router.get("/categories", adminAuth, controller.categoryList);
router.put("/categories/:id", adminAuth, controller.categoryUpdate);
router.delete("/categories/:id", adminAuth, controller.categoryRemove);

// Blog search (placed before :id routes)
router.get("/search", adminAuth, controller.blogSearch);

// Blog routes
router.post("/", adminAuth, uploadAnyImage, controller.blogCreate);
router.get("/", adminAuth, controller.blogList);
router.get("/:id", adminAuth, controller.blogRead);
router.put("/:id", adminAuth, uploadAnyImage, controller.blogUpdate);
router.patch("/:id/status", adminAuth, controller.blogToggleStatus);
router.delete("/:id", adminAuth, controller.blogRemove);

module.exports = router;
