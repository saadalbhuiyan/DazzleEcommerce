const nodemailer = require("nodemailer");
const { SmtpConfig } = require("../modules/smtp/schema/smtp.model");
const { decrypt } = require("../utils/crypto");

async function getTransportFromDb() {
  const cfg = await SmtpConfig.findOne().sort({ updatedAt: -1 });
  if (!cfg) throw new Error("SMTP not configured");
  const pass = decrypt(cfg.passwordEnc);
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: Number(cfg.port) === 465,
    auth: { user: cfg.username, pass }
  });
}

module.exports = { getTransportFromDb };
