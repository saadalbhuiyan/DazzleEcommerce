const { Schema, model } = require("mongoose");
const OtpSchema = new Schema({
  email: { type: String, index: true },
  codeHash: String,
  expiresAt: Date,
  attempts: { type: Number, default: 0 }
}, { timestamps: true });
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports.OtpCode = model("OtpCode", OtpSchema);
