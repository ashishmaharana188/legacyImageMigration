// backend/src/api/duplicateProcessor/duplicateProcessorApp.ts

import express from "express";
import { duplicateProcessorController } from "./dataCleanController";

const duplicateProcessorRouter = express.Router();

duplicateProcessorRouter.post(
  "/sql/sanity-check-duplicates",
  duplicateProcessorController.sanityCheckDuplicates.bind(
    duplicateProcessorController
  )
);
duplicateProcessorRouter.post(
  "/mongo/sanity-check-duplicates",
  duplicateProcessorController.sanityCheckMongoDuplicates.bind(
    duplicateProcessorController
  )
);

export default duplicateProcessorRouter;
