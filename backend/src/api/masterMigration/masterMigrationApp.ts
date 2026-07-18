import { Router } from "express";
import multer from "multer";
import { checkFileIntegrity } from "../masterMigration/masterMigratioNController";

console.log("masterMigrationApp loaded");

const router = Router();

const upload = multer({
  dest: process.env.UPLOAD_DIR || "./uploads/",
});

router.get("/master-migrate/test", (_, res) => {
  res.send("master migration works");
});

router.post(
  "/master-migrate/check-file-integrity",
  upload.single("masterFile"),
  checkFileIntegrity,
);

export default router;
