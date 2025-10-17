// image helpers: save WebP (size-limited) and delete local file

const sharp = require("sharp");
const { v4: uuid } = require("uuid");
const fs = require("fs");
const path = require("path");

// ensure folder exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Convert buffer to WebP ≤ maxKB, max size maxWxmaxH.
 * Saves at: /uploads/{area}/{entityId}/{uuid}.webp
 */
async function saveWebp(
  buffer,
  { area, entityId = "misc", maxKB = 100, maxW = 1200, maxH = 1200 }
) {
  const baseDir = path.join(__dirname, "..", "uploads", area, entityId);
  ensureDir(baseDir);

  // first pass: resize + compress with starting quality
  let quality = 80;
  let out = await sharp(buffer)
    .rotate()
    .resize({ width: maxW, height: maxH, fit: "inside", withoutEnlargement: true })
    .webp({ quality, effort: 5 })
    .toBuffer();

  // reduce quality until 40 if over size
  while (out.length / 1024 > maxKB && quality > 40) {
    quality -= 10;
    out = await sharp(buffer)
      .rotate()
      .resize({ width: maxW, height: maxH, fit: "inside", withoutEnlargement: true })
      .webp({ quality, effort: 6 })
      .toBuffer();
  }

  // if still large, step down dimensions (not below ~400px edge)
  let w = maxW;
  let h = maxH;
  while (out.length / 1024 > maxKB && (w > 400 || h > 400)) {
    w = Math.floor(w * 0.85);
    h = Math.floor(h * 0.85);
    out = await sharp(out)
      .resize({ width: w, height: h, fit: "inside", withoutEnlargement: true })
      .webp({ quality: Math.max(40, quality) })
      .toBuffer();
  }

  // write file
  const filename = `${uuid()}.webp`;
  const absPath = path.join(baseDir, filename);
  fs.writeFileSync(absPath, out);

  // return relative path + basic meta
  const relPath = path.posix.join("/uploads", area, entityId, filename);
  const meta = await sharp(out).metadata();

  return {
    path: relPath,
    bytes: out.length,
    width: meta.width,
    height: meta.height,
  };
}

// delete a local file by relative path (best-effort)
function deleteLocal(relPath) {
  if (!relPath) return;
  const abs = path.join(__dirname, "..", relPath.replace(/^[\\/]+/, ""));
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    // ignore
  }
}

module.exports = { saveWebp, deleteLocal };
