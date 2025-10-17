const mongoose = require("mongoose");
const connectDb = async (uri) => {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { autoIndex: false });
  console.log("Mongo connected");
};
module.exports = { connectDb };
