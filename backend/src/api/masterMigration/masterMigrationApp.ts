import { Router } from "express";
import multer from "multer";
import {
  checkFileIntegrity,
  runETLProcessController,
} from "../masterMigration/masterMigratioNController";

console.log("masterMigrationApp loaded");

const router = Router();

const upload = multer({
  dest: process.env.UPLOAD_DIR || "./uploads/",
});

router.post(
  "/master-migrate/check-file-integrity",
  upload.single("masterFile"),
  checkFileIntegrity,
);

router.post(
  "/master-migrate/ETLProcess",
  upload.single("masterFile"),
  runETLProcessController,
);
export default router;
