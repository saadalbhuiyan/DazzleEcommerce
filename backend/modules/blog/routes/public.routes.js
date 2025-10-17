const express = require("express");
const router = express.Router();

const controller = require("../controller/public.controller");

// Blog list (?sort=new|old)
router.get("/", controller.publicList);

// Blog search (placed before slug to avoid conflict)
router.get("/search", controller.publicSearch);

// Blogs by category
router.get("/category/:slug", controller.publicByCategory);

// Single blog by slug
router.get("/:slug", controller.publicRead);

module.exports = router;
