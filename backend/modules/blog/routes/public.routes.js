// modules/blog/routes/public.routes.js
const r = require("express").Router();
const pub = require("../controller/public.controller");

// list (new/old via ?sort=new|old)
r.get("/", pub.publicList);

// search BEFORE slug to avoid being captured by '/:slug'
r.get("/search", pub.publicSearch);

// by category
r.get("/category/:slug", pub.publicByCategory);

// single by slug
r.get("/:slug", pub.publicRead);

module.exports = r;
