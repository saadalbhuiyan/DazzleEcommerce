const { Schema, model } = require("mongoose");
const SmtpSchema = new Schema({
  host: String,
  port: Number,
  username: String,
  passwordEnc: String,
  createdBy: String,
  updatedBy: String
}, { timestamps: true });
module.exports.SmtpConfig = model("SmtpConfig", SmtpSchema);
