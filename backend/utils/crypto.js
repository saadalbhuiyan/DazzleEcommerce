// crypto helpers: hashing (bcrypt) + symmetric encrypt/decrypt (AES-256-CBC)

const bcrypt = require("bcrypt");
const crypto = require("crypto");

// config
const SALT_ROUNDS = 10; // bcrypt cost
const ENC_KEY = (process.env.ENCRYPTION_KEY || "").padEnd(32, "0").slice(0, 32); // 32 bytes
const IV_LEN = 16; // 16 bytes for AES-CBC

// password hashing
const hash = (str) => bcrypt.hash(str, SALT_ROUNDS);
const verify = (str, hashed) => bcrypt.compare(str, hashed);

// AES-256-CBC encrypt -> "ivBase64:cipherBase64"
function encrypt(plain) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENC_KEY), iv);

  let enc = cipher.update(plain, "utf8", "base64");
  enc += cipher.final("base64");

  return `${iv.toString("base64")}:${enc}`;
}

// AES-256-CBC decrypt from "ivBase64:cipherBase64"
function decrypt(enc) {
  const [ivB64, dataB64] = enc.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENC_KEY), iv);

  let dec = decipher.update(dataB64, "base64", "utf8");
  dec += decipher.final("utf8");

  return dec;
}

module.exports = { hash, verify, encrypt, decrypt };
