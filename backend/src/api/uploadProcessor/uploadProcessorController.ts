import { Request, Response } from "express";
import { processExcelFile as wrapperProcessExcelFile } from "./uploadProcessorWrapper";
import { runAndDownloadAthenaQuery } from "../../utils/athenaService";

class UploadProcessorController {
  async processExcelFile(req: Request, res: Response) {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const onProgress = (stats: any) => {
        // --- DEBUGGING BLOCK ---
        const wss = req.app.get("wss");
        const clientCount = wss ? wss.clients.size : 0;

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
  // [NEW] Athena Query Executor
    async runAthena(req: Request, res: Response): Promise<void> {
      try {
        // 1. We only need the query now, no clientDirName
        const { query } = req.body;

        if (!query) {
          res.status(400).json({ error: "SQL Query is required" });
          return;
        }

        // 2. Pass ONLY the query to the service
        const csvData = await runAndDownloadAthenaQuery(query);

        res.status(200).json({ statusCode: 200, csvData });
      } catch (error: any) {
        console.error("Athena Query Error:", error);
        res.status(500).json({ error: "Athena query failed", details: error.message });
      }
    }

}



export const uploadProcessorController = new UploadProcessorController();
