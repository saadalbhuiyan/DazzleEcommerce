const sharp = require("sharp");
const { v4: uuid } = require("uuid");
const fs = require("fs");
const path = require("path");

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

/**
 * Convert any input image buffer to WebP ≤ 100KB, max 1200x1200.
 * Saves to: /uploads/{area}/{entityId}/{uuid}.webp
 */
async function saveWebp(buffer, { area, entityId = "misc", maxKB = 100, maxW = 1200, maxH = 1200 }) {
  const dir = path.join(__dirname, "..", "uploads", area, entityId);
  ensureDir(dir);

  let quality = 80;
  let out = await sharp(buffer).rotate().resize({ width: maxW, height: maxH, fit: "inside", withoutEnlargement: true }).webp({ quality, effort: 5 }).toBuffer();

  while (out.length / 1024 > maxKB && quality > 40) {
    quality -= 10;
    out = await sharp(buffer).rotate().resize({ width: maxW, height: maxH, fit: "inside", withoutEnlargement: true }).webp({ quality, effort: 6 }).toBuffer();
  }

  let w = maxW, h = maxH;
  while (out.length / 1024 > maxKB && (w > 400 || h > 400)) {
    w = Math.floor(w * 0.85); h = Math.floor(h * 0.85);
    out = await sharp(out).resize({ width: w, height: h, fit: "inside", withoutEnlargement: true }).webp({ quality: Math.max(40, quality) }).toBuffer();
  }

  const filename = uuid() + ".webp";
  const abs = path.join(dir, filename);
  fs.writeFileSync(abs, out);

  const rel = path.posix.join("/uploads", area, entityId, filename);
  const meta = await sharp(out).metadata();
  return { path: rel, bytes: out.length, width: meta.width, height: meta.height };
}

function deleteLocal(relPath) {
  if (!relPath) return;
  const abs = path.join(__dirname, "..", relPath.replace(/^[\\/]+/, ""));
  try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch (_) {}
}

module.exports = { saveWebp, deleteLocal };
