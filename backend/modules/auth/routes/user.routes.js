const r = require("express").Router();
const userAuth = require("../../../middleware/authUser");
const { uploadAnyImage } = require("../../../middleware/uploadFile");
const c = require("../controller/user.controller");

// auth
r.post("/otp/request", c.requestOtp);
r.post("/otp/verify",  c.verifyOtp);
r.post("/refresh",     c.refresh);
r.post("/logout",      c.logout);
r.delete("/account",   c.deleteAccount);

// profile fields CRUD
// name
r.post("/profile/name",    userAuth, c.nameCreate);
r.get("/profile/name",     userAuth, c.nameRead);
r.put("/profile/name",     userAuth, c.nameUpdate);
r.delete("/profile/name",  userAuth, c.nameDelete);

// mobile
r.post("/profile/mobile",   userAuth, c.mobileCreate);
r.get("/profile/mobile",    userAuth, c.mobileRead);
r.put("/profile/mobile",    userAuth, c.mobileUpdate);
r.delete("/profile/mobile", userAuth, c.mobileDelete);

// address
r.post("/profile/address",   userAuth, c.addressCreate);
r.get("/profile/address",    userAuth, c.addressRead);
r.put("/profile/address",    userAuth, c.addressUpdate);
r.delete("/profile/address", userAuth, c.addressDelete);

// picture (multipart: file)
r.post("/profile/picture",   userAuth, uploadAnyImage, c.picCreate);
r.get("/profile/picture",    userAuth, c.picRead);
r.put("/profile/picture",    userAuth, uploadAnyImage, c.picUpdate);
r.delete("/profile/picture", userAuth, c.picDelete);

module.exports = r;
