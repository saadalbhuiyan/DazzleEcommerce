// db/connect.js

'use strict';

const mongoose = require('mongoose');

// Connect to MongoDB
const connectDb = async (uri) => {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { autoIndex: false });
  console.log('✅ MongoDB connected');
};

module.exports = { connectDb };
