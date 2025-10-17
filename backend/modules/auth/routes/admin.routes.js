const r = require("express").Router();
const adminAuth = require("../../../middleware/authAdmin");
const { uploadAnyImage } = require("../../../middleware/uploadFile");
const c = require("../controller/admin.controller");

// sessions
r.post("/login",   c.login);
r.post("/refresh", c.refresh);
r.post("/logout",  c.logout);

// profile name
r.post("/profile/name",   adminAuth, c.nameCreate);
r.get("/profile/name",    adminAuth, c.nameRead);
r.put("/profile/name",    adminAuth, c.nameUpdate);
r.delete("/profile/name", adminAuth, c.nameDelete);

// profile picture (multipart: file)
r.post("/profile/picture",    adminAuth, uploadAnyImage, c.picCreate);
r.get("/profile/picture",     adminAuth, c.picRead);
r.put("/profile/picture",     adminAuth, uploadAnyImage, c.picUpdate);
r.delete("/profile/picture",  adminAuth, c.picDelete);

// insights
r.get("/users/count", adminAuth, c.usersCount);
r.get("/users",       adminAuth, c.usersList);

module.exports = r;
