import { Router } from "express";
import multer from "multer";
import { checkFileIntegrity } from "../masterMigration/masterMigratioNController";

const router = Router();

const upload = multer({
  dest: process.env.UPLOAD_DIR || "./uploads/",
});

router.post(
  "/check-file-integrity",
  upload.single("masterFile"),
  checkFileIntegrity,
);

export default router;
