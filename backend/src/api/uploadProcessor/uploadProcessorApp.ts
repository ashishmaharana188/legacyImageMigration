import express from "express";
import multer from "multer";
import { uploadProcessorController } from "./uploadProcessorController";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, "uploads"),
  filename: (_req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage: storage });

router.post("/upload-excel", upload.single("excel"), (req, res) =>
  uploadProcessorController.processExcelFile(req, res)
);
router.post("/run-fallback", upload.single("excel"), (req, res) =>
  uploadProcessorController.runFallback(req, res)
);

export default router;
