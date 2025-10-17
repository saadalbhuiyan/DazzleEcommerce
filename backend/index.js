// main server setup

require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const cors = require("cors");
const path = require("path");
const { connectDb } = require("./config/db");

// check required environment variables
[
  "MONGO_URI",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "ENCRYPTION_KEY",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
].forEach((key) => {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
});

// connect to database
connectDb(process.env.MONGO_URI);

const app = express();

// middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("combined"));

// serve static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// OTP rate limiter for /api/auth/otp/request
const otpBuckets = new Map();
app.use("/api/auth/otp/request", (req, res, next) => {
  const now = Date.now();
  const key = req.ip;
  const windowMs = 3 * 60 * 1000; // 3 minutes
  const max = 6;

  const recent = (otpBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    return res
      .status(429)
      .json({ ok: false, message: "Too many OTP requests" });
  }

  recent.push(now);
  otpBuckets.set(key, recent);
  next();
});

// routes
app.use("/api/admin/auth", require("./modules/auth/routes/admin.routes"));
app.use("/api/auth", require("./modules/auth/routes/user.routes"));
app.use("/api/admin/smtp", require("./modules/smtp/routes/admin.routes"));
app.use("/api/admin/blogs", require("./modules/blog/routes/admin.routes"));
app.use("/api/public/blogs", require("./modules/blog/routes/public.routes"));

// health check
app.get("/health", (_req, res) => res.json({ ok: true }));

// 404
app.use((_req, res) =>
  res.status(404).json({ ok: false, message: "route not found" })
);

// error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res
    .status(err.status || 500)
    .json({ ok: false, message: err.message || "server error" });
});

// start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
