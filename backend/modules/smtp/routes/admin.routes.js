const r = require("express").Router();
const adminAuth = require("../../../middleware/authAdmin");
const c = require("../controller/admin.controller");

r.post("/",    adminAuth, c.create);
r.get("/",     adminAuth, c.read);
r.put("/:id",  adminAuth, c.update);
r.delete("/:id", adminAuth, c.remove);

module.exports = r;
