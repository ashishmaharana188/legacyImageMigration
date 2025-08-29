import { Request, Response } from "express";
import { PdfProcessing } from "../services/pdfProcessor";
import { Splitting } from "../services/splitProcessor";
import { Database } from "../services/database";
import path from "path";
import fs from "fs/promises";

class FileController {
  async processExcelFile(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      console.log(`Processing file: ${req.file.originalname}`);
      const processor = new PdfProcessing();
      const result = await processor.processExcelFile(req.file.path);
      res.json({
        message: "File processed successfully",
        originalFile: req.file.originalname,
        processedFile: result.outputFileName,
        summary: result.summary,
        downloadUrl: `/download/${result.outputFileName}`,
        fileUrls: result.files.map((file) => ({
          row: file.row,
          url: `/download-file/${encodeURIComponent(file.destinationPath)}`,
          pageCount: file.pageCount,
        })),
      });
    } catch (error) {
      console.error("Processing error:", error);
      res.status(500).json({
        error: "Failed to process file",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async downloadFile(req: Request, res: Response) {
    try {
      const filename = req.params.filename;
      const filePath = path.join("processed", filename);
      if (
        !(await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false))
      ) {
        return res.status(404).json({ error: "File not found" });
      }
      res.setHeader("Content-Type", "text/csv"); // Set for CSV
      res.download(filePath, filename);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  }

  async downloadReferencedFile(req: Request, res: Response) {
    try {
      const filePath = decodeURIComponent(req.params.filePath);
      if (
        !(await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false))
      ) {
        return res.status(404).json({ error: "File not found" });
      }
      res.download(filePath, path.basename(filePath));
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  }

  async splitFiles(req: Request, res: Response) {
    try {
      const processor = new Splitting();
      const result = await processor.splitFiles();
      res.json({
        message: "Files split successfully",
        splitFiles: result.splitFiles.map((file: any) => ({
          originalPath: file.originalPath,
          url: `/download-file/${encodeURIComponent(file.splitPath)}`,
          page: file.page,
        })),
      });
    } catch (error) {
      console.error("Split error:", error);
      res.status(500).json({
        error: "Failed to split files",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async generateSql(req: Request, res: Response) {
    try {
      const processor = new Database();
      const result = await processor.generateSql(); // Call new method in pdfProcessor.ts
      res.json({
        message: "SQL generated successfully",
        sql: result.sql,
      });
    } catch (error) {
      console.error("SQL generation error:", error);
      res.status(500).json({
        error: "Failed to generate SQL",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async executeSql(req: Request, res: Response) {
    try {
      const processor = new Database();
      const result = await processor.executeSql();
      res.json({
        message:
          result.result === "success"
            ? "SQL executed successfully"
            : "SQL execution failed",
        result: result.result,
        logs: result.logs,
      });
    } catch (error) {
      console.error("SQL execution error:", error);
      res.status(500).json({
        error: "Failed to execute SQL",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async updateFolioAndTransaction(req: Request, res: Response) {
    try {
      const processor = new Database();
      const result = await processor.updateFolioAndTransaction();
      res.json({
        message:
          result.result === "success"
            ? "Folio_id updated successfully"
            : "Folio_id update failed",
        result: result.result,
        logs: result.logs,
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to run updateFolioAndTransaction()",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export const fileController = new FileController();
