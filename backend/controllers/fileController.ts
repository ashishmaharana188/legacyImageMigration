import { Request, Response } from "express";
import { PdfProcessing } from "../services/pdfProcessor";
import { Splitting } from "../services/splitProcessor";
import { Database } from "../services/database";
import { uploadDirectoryRecursive } from "../services/s3Uploader";
import path from "path";
import fs from "fs/promises";
import { S3_BUCKET_NAME, getS3Prefix } from "../utils/s3Config";
import { wss } from "../app";
import { WebSocket } from "ws"; // Added this line

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
      res.status(500).json({
        error: "Failed to download file",
        details: error instanceof Error ? error.message : "Unknown error",
      });
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
      res.status(500).json({
        error: "Failed to download file",
        details: error instanceof Error ? error.message : "Unknown error",
      });
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

  async sanityCheckDuplicates(req: Request, res: Response) {
    try {
      const { cutoffTms, dryRun, normalize } = req.body;
      const processor = new Database();
      const result = await processor.sanityCheckDuplicates({
        dryRun,
        normalize,
      });
      res.json(result);
    } catch (error) {
      console.error("Sanity check error:", error);
      res.status(500).json({
        error: "Failed to run sanity check",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async uploadToS3(req: Request, res: Response) {
    try {
      console.log("--- AWS Credential Check (from fileController) ---");
      console.log(
        "AWS_ACCESS_KEY_ID:",
        process.env.AWS_ACCESS_KEY_ID ? "Set" : "Not Set"
      );
      console.log(
        "AWS_SECRET_ACCESS_KEY:",
        process.env.AWS_SECRET_ACCESS_KEY ? "Set (Masked)" : "Not Set"
      );
      console.log(
        "AWS_SESSION_TOKEN:",
        process.env.AWS_SESSION_TOKEN ? "Set" : "Not Set"
      );
      console.log(
        "AWS_DEFAULT_REGION:",
        process.env.AWS_DEFAULT_REGION || "ap-south-1"
      );
      console.log(
        "S3_BUCKET_NAME:",
        S3_BUCKET_NAME // Using centralized config
      );
      console.log("--------------------------------------------------");

      const outputRoot = path.join(__dirname, "../../output");
      const bucket = S3_BUCKET_NAME; // Using centralized config

      const clients = await fs.readdir(outputRoot, { withFileTypes: true });
      for (const clientDir of clients) {
        if (
          clientDir.isDirectory() &&
          clientDir.name.startsWith("CLIENT_CODE_")
        ) {
          const clientPath = path.join(outputRoot, clientDir.name);
          const s3Prefix = getS3Prefix(clientDir.name); // Using centralized config
          console.log(
            `Uploading ${clientDir.name} → s3://${bucket}/${s3Prefix}`
          );
          await uploadDirectoryRecursive(clientPath, bucket, s3Prefix);
        }
      }
      res.json({ message: "Files uploaded to S3 successfully" });
      // Send WebSocket message on success
      wss.clients.forEach((client: WebSocket) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "s3UploadStatus",
              status: "success",
              message: "S3 upload completed successfully!",
            })
          );
        }
      });
    } catch (error) {
      console.error("S3 upload error:", error);
      res.status(500).json({
        error: "Failed to upload files to S3",
        details: error instanceof Error ? error.message : "Unknown error",
      });
      // Send WebSocket message on error
      wss.clients.forEach((client: WebSocket) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "s3UploadStatus",
              status: "error",
              message: `S3 upload failed: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            })
          );
        }
      });
    }
  }
}

export const fileController = new FileController();
