const { Schema, model } = require("mongoose");
const UserSchema = new Schema({
  email: { type: String, unique: true, index: true },
  name: { type: String, default: null },
  mobile: { type: String, default: null },
  address: { type: String, default: null },
  pictureUrl: { type: String, default: null },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });
module.exports.User = model("User", UserSchema);
