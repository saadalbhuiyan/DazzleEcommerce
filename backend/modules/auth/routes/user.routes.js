const express = require("express");
const router = express.Router();

const userAuth = require("../../../middleware/authUser");
const { uploadAnyImage } = require("../../../middleware/uploadFile");
const controller = require("../controller/user.controller");

// Auth routes
router.post("/otp/request", controller.requestOtp);
router.post("/otp/verify", controller.verifyOtp);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);
router.delete("/account", controller.deleteAccount);

// Profile name routes
router.post("/profile/name", userAuth, controller.nameCreate);
router.get("/profile/name", userAuth, controller.nameRead);
router.put("/profile/name", userAuth, controller.nameUpdate);
router.delete("/profile/name", userAuth, controller.nameDelete);

// Profile mobile routes
router.post("/profile/mobile", userAuth, controller.mobileCreate);
router.get("/profile/mobile", userAuth, controller.mobileRead);
router.put("/profile/mobile", userAuth, controller.mobileUpdate);
router.delete("/profile/mobile", userAuth, controller.mobileDelete);

// Profile address routes
router.post("/profile/address", userAuth, controller.addressCreate);
router.get("/profile/address", userAuth, controller.addressRead);
router.put("/profile/address", userAuth, controller.addressUpdate);
router.delete("/profile/address", userAuth, controller.addressDelete);

// Profile picture routes (multipart: file)
router.post("/profile/picture", userAuth, uploadAnyImage, controller.picCreate);
router.get("/profile/picture", userAuth, controller.picRead);
router.put("/profile/picture", userAuth, uploadAnyImage, controller.picUpdate);
router.delete("/profile/picture", userAuth, controller.picDelete);

module.exports = router;
