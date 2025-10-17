const bcrypt = require("bcrypt");
const crypto = require("crypto");

const SALT = 10;
const ENC_KEY = (process.env.ENCRYPTION_KEY || "").padEnd(32,"0").slice(0,32);
const IV_LEN = 16;

const hash = (s) => bcrypt.hash(s, SALT);
const verify = (s, h) => bcrypt.compare(s, h);

function encrypt(plain){
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENC_KEY), iv);
  let enc = cipher.update(plain, "utf8", "base64");
  enc += cipher.final("base64");
  return iv.toString("base64") + ":" + enc;
}
function decrypt(enc){
  const [ivb64, data] = enc.split(":");
  const iv = Buffer.from(ivb64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENC_KEY), iv);
  let dec = decipher.update(data, "base64", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

module.exports = { hash, verify, encrypt, decrypt };
