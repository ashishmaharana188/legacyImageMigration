import { Request, Response } from "express";
import { spawn } from "child_process";
import logger from "../../utils/logger";
import path from "path";
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
            status: "Transferring Files...",
            processedRows: stats.processedRows,
            totalRows: stats.totalRows,
            successfulRows: stats.successfulRows,
            errorRows: stats.errors,
            notFoundRows: stats.notFound,
          };
          wss.clients.forEach((client: any) => {
            if (client.readyState === 1) client.send(JSON.stringify(message));
          });
        }
      };

      // Await the entire loop before responding
      const result = await wrapperProcessExcelFile(req.file.path, onProgress);

      res.status(200).json({
        statusCode: 200,
        message: "Processing Complete",
        summary: result.summary,
        downloadUrl: `/download/${result.outputFileName}`,
      });
    } catch (error) {
      res.status(500).json({ error: "Processing failed", details: error });
    }
  }

  async runFallback(req: Request, res: Response) {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const pythonScript = path.resolve(
        __dirname,
        "../../../services/fallback_processor.py"
      );
      const pythonExec = process.env.PYTHON_EXECUTABLE_PATH || "python";
      const child = spawn(pythonExec, [pythonScript, req.file.path]);

      child.on("close", (code) => {
        if (code === 0)
          res.status(200).json({ message: "Fallback successful" });
        else
          res.status(500).json({ error: `Fallback failed with code ${code}` });
      });
    } catch (error) {
      res.status(500).json({ error: "Fallback error" });
    }
  }
}

export const uploadProcessorController = new UploadProcessorController();
