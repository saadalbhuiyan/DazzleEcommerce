require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const cors = require("cors");
const path = require("path");
const { connectDb } = require("./config/db");

[
  "MONGO_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET",
  "ENCRYPTION_KEY", "ADMIN_EMAIL", "ADMIN_PASSWORD"
].forEach(k => { if (!process.env[k]) throw new Error(`Missing env var: ${k}`); });

connectDb(process.env.MONGO_URI);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("combined"));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// OTP rate limiter (per IP) only for /api/auth/otp/request
const otpBuckets = new Map();
app.use("/api/auth/otp/request", (req, res, next) => {
  const now = Date.now(), key = req.ip, windowMs = 3 * 60 * 1000, max = 6;
  const arr = (otpBuckets.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) return res.status(429).json({ ok:false, message:"Too many OTP requests" });
  arr.push(now); otpBuckets.set(key, arr); next();
});

// mount routes
app.use("/api/admin/auth",    require("./modules/auth/routes/admin.routes"));
app.use("/api/auth",          require("./modules/auth/routes/user.routes"));

app.use("/api/admin/smtp",    require("./modules/smtp/routes/admin.routes"));

app.use("/api/admin/blogs",   require("./modules/blog/routes/admin.routes"));
app.use("/api/public/blogs",  require("./modules/blog/routes/public.routes"));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use((_req, res) => res.status(404).json({ ok:false, message:"route not found" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ ok:false, message: err.message || "server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on :${PORT}`));
