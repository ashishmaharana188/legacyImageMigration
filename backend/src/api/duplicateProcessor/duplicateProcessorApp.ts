// backend/src/api/duplicateProcessor/duplicateProcessorApp.ts

import express from "express";
import { duplicateProcessorController } from "./duplicateProcessorController";

const duplicateProcessorRouter = express.Router();

duplicateProcessorRouter.get(
  "/sql/sanity-check-duplicates",
  duplicateProcessorController.sanityCheckDuplicates.bind(duplicateProcessorController)
);
duplicateProcessorRouter.get(
  "/mongo/sanity-check-duplicates",
  duplicateProcessorController.sanityCheckMongoDuplicates.bind(duplicateProcessorController)
);

export default duplicateProcessorRouter;
