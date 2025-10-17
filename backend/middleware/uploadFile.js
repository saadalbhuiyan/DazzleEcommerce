// middleware/uploadImage.js

'use strict';

const multer = require('multer');

// Multer setup: store file in memory (validate/process with Sharp later)
const uploadAnyImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
}).single('file');

module.exports = { uploadAnyImage };
