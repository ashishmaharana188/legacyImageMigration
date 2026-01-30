import { Request, Response } from "express";
// FIX: Import from the current folder, NOT imageDataTransfer
import { processExcelFile as wrapperProcessExcelFile } from "./uploadProcessorWrapper";

class UploadProcessorController {
  async processExcelFile(req: Request, res: Response) {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const onProgress = (stats: any) => {
        const wss = req.app.get("wss");
        if (wss) {
          const message = {
            type: "excelProcessingUpdate", // Aligned with frontend
            totalRows: stats.totalRows,
            processedRows: stats.processedRows,
            successfulRows: stats.successfulRows,
            errors: stats.errors,
            notFound: stats.notFound,
            status: "Transferring Files...",
          };
          wss.clients.forEach((client: any) => {
            if (client.readyState === 1) {
              client.send(JSON.stringify(message));
            }
          });
        }
      };

      const result = await wrapperProcessExcelFile(req.file.path, onProgress);

      // FIX: Map the result into the format the UI expects
      res.status(200).json({
        statusCode: 200,
        summary: {
          totalRows: result.totalRows,
          successfulRows: result.successfulRows,
          errors: result.errors,
          notFound: result.notFound,
        },
        processedFile: result.outputFileName,
      });
    } catch (error) {
      res.status(500).json({ error: "Processing failed", details: error });
    }
  }

  async runFallback(req: Request, res: Response) {
    // Fallback logic
  }
}

export const uploadProcessorController = new UploadProcessorController();
