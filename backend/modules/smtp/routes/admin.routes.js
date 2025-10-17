const express = require("express");
const router = express.Router();

const adminAuth = require("../../../middleware/authAdmin");
const controller = require("../controller/admin.controller");

// Basic CRUD routes
router.post("/", adminAuth, controller.create);
router.get("/", adminAuth, controller.read);
router.put("/:id", adminAuth, controller.update);
router.delete("/:id", adminAuth, controller.remove);

module.exports = router;
