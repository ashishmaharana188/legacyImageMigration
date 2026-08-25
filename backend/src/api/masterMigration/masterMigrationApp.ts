import { Router } from "express";
import multer from "multer";
import {
  stagingValidateUpsertController,
  masterMigrateMongoController,
} from "../masterMigration/masterMigrationController";

console.log("masterMigrationApp loaded");

const router = Router();

const upload = multer({
  dest: process.env.UPLOAD_DIR || "./uploads/",
});

router.post(
  "/master-migrate/stagingUpsertMongo",
  upload.single("masterFile"),
  stagingValidateUpsertController,
);

router.post(
  "/master-migrate/masterStagingMongo",
  upload.single("masterFile"),
  masterMigrateMongoController,
);
export default router;
