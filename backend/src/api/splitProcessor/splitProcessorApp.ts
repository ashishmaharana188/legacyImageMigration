import express from "express";
import { splitFilesController } from "./splitProcessorController";

const router = express.Router();

router.post("/split-files", splitFilesController.splitFiles.bind(splitFilesController));
router.post("/split-mupdf", splitFilesController.splitFilesWithMuPDF.bind(splitFilesController));

export default router;
