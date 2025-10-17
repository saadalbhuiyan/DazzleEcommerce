const multer = require("multer");

// in-memory buffer; validate/process with sharp later
const uploadAnyImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
}).single("file");

module.exports = { uploadAnyImage };
