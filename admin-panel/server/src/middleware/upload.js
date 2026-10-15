const multer = require('multer');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    if (!ok) {
      return cb(new AppError('Only .xlsx, .xls, or .csv files are allowed', 400));
    }
    return cb(null, true);
  },
});

// const uploadRoot = path.resolve(env.uploadDir);
const uploadRoot = path.isAbsolute(env.uploadDir)
  ? env.uploadDir
  : path.resolve(__dirname, '../../', env.uploadDir);
if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const diskUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, uploadRoot);
    },
    filename(req, file, cb) {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new AppError('Only image uploads are allowed', 400));
    }
    return cb(null, true);
  },
});

module.exports = {
  memoryUpload,
  diskUpload,
  uploadRoot,
};
