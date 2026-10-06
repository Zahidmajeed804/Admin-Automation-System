import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import { env } from "../config/env.js";
import { BadRequestError } from "../errors/AppError.js";

// Only what a maintenance invoice actually is: a scanned document or receipt.
const EXTENSION_BY_MIME = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

// Resolved once at import time, relative to wherever the backend process is
// run from (the same "cwd" convention every npm script — dev/start/test —
// already uses).
export const invoiceUploadDir = path.resolve(env.invoiceUploadDir);
fs.mkdirSync(invoiceUploadDir, { recursive: true });

const storage = multer.diskStorage({
  // Re-created on every request, not only at import: if the folder is ever
  // removed while the process keeps running (a disk cleanup, a bad deploy
  // step), the next upload recreates it instead of failing with an ENOENT
  // that would otherwise reach the client as a raw 500.
  destination: (req, file, cb) => {
    try {
      fs.mkdirSync(invoiceUploadDir, { recursive: true });
      cb(null, invoiceUploadDir);
    } catch (err) {
      cb(err);
    }
  },
  // A random name on disk — never the client-supplied filename — so two
  // uploads can't collide and a crafted name can't escape the folder. The
  // original filename is kept separately, in the database, for display.
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${EXTENSION_BY_MIME[file.mimetype]}`),
});

const upload = multer({
  storage,
  limits: { fileSize: env.invoiceMaxSizeMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!EXTENSION_BY_MIME[file.mimetype]) {
      return cb(new BadRequestError(`Invoice must be a PDF, JPG or PNG file (got ${file.mimetype})`));
    }
    cb(null, true);
  },
}).single("invoice");

/**
 * Wraps multer's single-file upload so its errors — wrong file type, too
 * large, no file at all — reach the app's normal error handler as a 400
 * instead of multer's own uncaught shape. Route handlers after this one can
 * assume req.file is present and valid.
 */
export function uploadInvoice(req, res, next) {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? `Invoice must be ${env.invoiceMaxSizeMb}MB or smaller`
          : err.message;
      return next(new BadRequestError(message));
    }
    if (err) return next(err); // already a BadRequestError from fileFilter, or something unexpected
    if (!req.file) return next(new BadRequestError("An invoice file is required"));
    next();
  });
}
