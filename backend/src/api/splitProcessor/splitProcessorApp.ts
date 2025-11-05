import express from "express";
import { splitFilesController } from "./splitProcessorController";

const router = express.Router();

router.post("/split-files", splitFilesController.splitFiles);
router.post("/split-mupdf", splitFilesController.splitFilesWithMuPDF);

export default router;
