import { Request, Response } from "express";
import { processExcelFile as wrapperProcessExcelFile } from "./uploadProcessorWrapper";
import { runAndDownloadAthenaQuery } from "../../utils/athenaService";
import { processAthenaDataThroughPostgres } from "./uploadProcessorUtil";

import { parse as parseCsv } from "csv-parse/sync";
import { stringify as stringifyCsv } from "csv-stringify/sync";

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

  async runAthena(req: Request, res: Response): Promise<void> {
    try {
      const { query } = req.body;
      if (!query) {
        res.status(400).json({ error: "SQL Query is required" });
        return;
      }

      // 1. Get raw CSV from Athena
      const rawAthenaCsv = await runAndDownloadAthenaQuery(query);

      // 2. Parse into JSON
      const parsedData = parseCsv(rawAthenaCsv, {
        columns: (headers) =>
          headers.map((h: string) => h.trim().toLowerCase()),
        skip_empty_lines: true,
      });

      // 3. Run through Postgres Auto-Schema & Filter Pipeline
      const filteredJsonRows = await processAthenaDataThroughPostgres(
        parsedData
      );

      // 4. Convert the filtered JSON back to a CSV string
      let finalCsvString = "";
      if (filteredJsonRows.length > 0) {
        finalCsvString = stringifyCsv(filteredJsonRows, { header: true });
      } else {
        // If 0 rows are found, return headers only so the frontend doesn't crash
        finalCsvString = Object.keys(parsedData[0] || {}).join(",") + "\n";
      }

      // 5. Send to frontend!
      res.status(200).json({ statusCode: 200, csvData: finalCsvString });
    } catch (error: any) {
      console.error("Athena/DB Pipeline Error:", error);
      res
        .status(500)
        .json({ error: "Pipeline failed", details: error.message });
    }
  }
}

export const uploadProcessorController = new UploadProcessorController();
