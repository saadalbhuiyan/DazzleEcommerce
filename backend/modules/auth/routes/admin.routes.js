const express = require("express");
const router = express.Router();

const adminAuth = require("../../../middleware/authAdmin");
const { uploadAnyImage } = require("../../../middleware/uploadFile");
const controller = require("../controller/admin.controller");

// Auth routes
router.post("/login", controller.login);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);

// Profile name routes
router.post("/profile/name", adminAuth, controller.nameCreate);
router.get("/profile/name", adminAuth, controller.nameRead);
router.put("/profile/name", adminAuth, controller.nameUpdate);
router.delete("/profile/name", adminAuth, controller.nameDelete);

// Profile picture routes
router.post("/profile/picture", adminAuth, uploadAnyImage, controller.picCreate);
router.get("/profile/picture", adminAuth, controller.picRead);
router.put("/profile/picture", adminAuth, uploadAnyImage, controller.picUpdate);
router.delete("/profile/picture", adminAuth, controller.picDelete);

// User insights
router.get("/users/count", adminAuth, controller.usersCount);
router.get("/users", adminAuth, controller.usersList);

module.exports = router;
