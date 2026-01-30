import { Request, Response } from "express";
import { processExcelFile as wrapperProcessExcelFile } from "./uploadProcessorWrapper";

class UploadProcessorController {
  async processExcelFile(req: Request, res: Response) {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const onProgress = (stats: any) => {
        // --- DEBUGGING BLOCK ---
        const wss = req.app.get("wss");
        const clientCount = wss ? wss.clients.size : 0;
        console.log(
          `[DEBUG-CONTROLLER] Callback Triggered. Success: ${
            stats.successfulRows
          }. WSS Available: ${!!wss}. Clients: ${clientCount}`
        );

        if (!wss) {
          console.error(
            "[DEBUG-CRITICAL] WSS is UNDEFINED. Check server.ts/app.ts setup!"
          );
          return;
        }
        // ---------------------

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
    /* fallback logic */
  }
}

export const uploadProcessorController = new UploadProcessorController();
