// admin profile schema

const { Schema, model } = require("mongoose");

const AdminProfileSchema = new Schema(
  {
    email: { type: String, unique: true },
    name: { type: String, default: null },
    pictureUrl: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports.AdminProfile = model("AdminProfile", AdminProfileSchema);
