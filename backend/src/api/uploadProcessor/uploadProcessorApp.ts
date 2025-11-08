import express from "express";
import multer from "multer";
import * as fsp from "fs/promises";
import path from "path";
import { uploadProcessorController } from "./uploadProcessorController"; // New import

const router = express.Router();

const uploadDir = "uploads";
const processedDir = "processed";

async function ensureDirectories() {
  try {
    if (
      !(await fsp
        .access(uploadDir)
        .then(() => true)
        .catch(() => false))
    ) {
      await fsp.mkdir(uploadDir, { recursive: true });
      console.log(`Created directory: ${uploadDir}`);
    }
    if (
      !(await fsp
        .access(processedDir)
        .then(() => true)
        .catch(() => false))
    ) {
      await fsp.mkdir(processedDir, { recursive: true });
      console.log(`Created directory: ${processedDir}`);
    }
  } catch (err) {
    console.error("Failed to create directories:", err);
    process.exit(1);
  }
}

ensureDirectories();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.originalname.endsWith(".xlsx")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only .xlsx files are allowed"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post(
  "/upload-excel",
  upload.single("excel"),
  uploadProcessorController.processExcelFile
);

router.post("/run-fallback", upload.single("excel"), uploadProcessorController.runFallback);

export default router;