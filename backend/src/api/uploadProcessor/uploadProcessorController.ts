import { Request, Response } from "express";
import { processExcelFile as wrapperProcessExcelFile } from "./uploadProcessorWrapper";

class UploadProcessorController {
  async processExcelFile(req: Request, res: Response) {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const onProgress = (stats: any) => {
        const wss = req.app.get("wss");
        if (wss) {
          const message = {
            type: "excelProcessingUpdate",
            totalRows: stats.totalRows,
            processedRows: stats.processedRows,
            successfulRows: stats.successfulRows,
            errors: stats.errors,
            notFound: stats.notFound,
            status: "Transferring Files...",
          };
          wss.clients.forEach((client: any) => {
            if (client.readyState === 1) client.send(JSON.stringify(message));
          });
        }
      };

      const result = await wrapperProcessExcelFile(req.file.path, onProgress);
      res
        .status(200)
        .json({
          statusCode: 200,
          summary: result.summary,
          processedFile: result.outputFileName,
        });
    } catch (error) {
      res.status(500).json({ error: "Processing failed", details: error });
    }
  }

  async runFallback(req: Request, res: Response) {
    // Logic for fallback check
  }
}

export const uploadProcessorController = new UploadProcessorController();
