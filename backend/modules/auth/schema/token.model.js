// token session schema

const { Schema, model } = require("mongoose");

const TokenSessionSchema = new Schema(
  {
    userType: { type: String, enum: ["admin", "user"], index: true },
    subjectId: { type: String, index: true },
    refreshId: { type: String, unique: true },
    userAgent: String,
    ip: String,
    expiresAt: Date,
    revokedAt: Date,
  },
  { timestamps: true }
);

module.exports.TokenSession = model("TokenSession", TokenSessionSchema);
