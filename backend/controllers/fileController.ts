import { Request, Response } from "express";
import { PdfProcessing } from "../services/pdfProcessor";
import { Splitting } from "../services/splitProcessor";
import { Database } from "../services/database";
import { MongoDatabase } from "../services/mongoDatabase";
import { uploadDirectoryRecursive } from "../services/s3Uploader";
import { uploadSplitFilesToS3 } from "../services/s3Uploader";
import path from "path";
import fs from "fs/promises";
import {
  S3_BUCKET_NAME,
  getS3FilePrefix,
  getS3SplitPrefix,
} from "../utils/s3Config";
import { wss } from "../app";
import { WebSocket } from "ws"; // Added this line
import { listFiles, deleteFiles } from "../services/s3Manager";

class FileController {
  async processExcelFile(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ statusCode: 400, error: "No file uploaded" });
      }
      console.log(`Processing file: ${req.file.originalname}`);
      const processor = new PdfProcessing();
      const result = await processor.processExcelFile(req.file.path);
      res.status(200).json({
        statusCode: 200,
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
        statusCode: 500,
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
        return res
          .status(404)
          .json({ statusCode: 404, error: "File not found" });
      }
      res.setHeader("Content-Type", "text/csv"); // Set for CSV
      res.download(filePath, filename);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({
        statusCode: 500,
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
        return res
          .status(404)
          .json({ statusCode: 404, error: "File not found" });
      }
      res.download(filePath, path.basename(filePath));
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Failed to download file",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async splitFiles(req: Request, res: Response) {
    try {
      const processor = new Splitting();
      const result = await processor.splitFiles();
      res.status(200).json({
        statusCode: 200,
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
        statusCode: 500,
        error: "Failed to split files",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async generateSql(req: Request, res: Response) {
    try {
      const processor = new Database();
      const result = await processor.generateSql(); // Call new method in pdfProcessor.ts
      res.status(200).json({
        statusCode: 200,
        message: "SQL generated successfully",
        sql: result.sql,
      });
    } catch (error) {
      console.error("SQL generation error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Failed to generate SQL",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async executeSql(req: Request, res: Response) {
    try {
      const processor = new Database();
      const result = await processor.executeSql();
      res.status(200).json({
        statusCode: 200,
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
        statusCode: 500,
        error: "Failed to execute SQL",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async updateFolioAndTransaction(req: Request, res: Response) {
    try {
      const processor = new Database();
      const result = await processor.updateFolioAndTransaction();
      res.status(200).json({
        statusCode: 200,
        message:
          result.result === "success"
            ? "Folio_id updated successfully"
            : "Folio_id update failed",
        result: result.result,
        logs: result.logs,
      });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
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
      res.status(200).json({ statusCode: 200, ...result });
    } catch (error) {
      console.error("Sanity check error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Failed to run sanity check",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async transferDataToMongo(req: Request, res: Response) {
    try {
      const mongoDatabase = new MongoDatabase();
      const result = await mongoDatabase.transferDataFromPostgres();
      res.status(200).json({
        statusCode: 200,
        message: `Transferred ${result.transferredCount} documents to MongoDB successfully.`,
      });
    } catch (error) {
      console.error("Data transfer error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Failed to transfer data to MongoDB",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async uploadToS3(req: Request, res: Response) {
    try {
      const isProduction = process.env.NODE_ENV === "production";
      if (!isProduction) {
        const message = "Skipping S3 upload in development environment.";
        console.log(message);
        // Send WebSocket message
        wss.clients.forEach((client: WebSocket) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: "s3UploadStatus",
                status: "skipped",
                message: message,
              })
            );
          }
        });
        return res.status(200).json({ statusCode: 200, message: message });
      }

      const outputRoot = path.join(__dirname, "../../output");
      const bucket = S3_BUCKET_NAME; // Using centralized config

      const clients = await fs.readdir(outputRoot, { withFileTypes: true });
      for (const clientDir of clients) {
        if (
          clientDir.isDirectory() &&
          clientDir.name.startsWith("CLIENT_CODE_")
        ) {
          const clientPath = path.join(outputRoot, clientDir.name);
          const s3Prefix = getS3FilePrefix(clientDir.name); // Using centralized config
          console.log(
            `Uploading ${clientDir.name} → s3://${bucket}/${s3Prefix}`
          );
          await uploadDirectoryRecursive(clientPath, bucket, s3Prefix);
        }
      }
      res.status(200).json({
        statusCode: 200,
        message: "Files uploaded to S3 successfully",
      });
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
        statusCode: 500,
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

  async uploadSplitFilesToS3(req: Request, res: Response) {
    const splitOutputRoot = path.join(__dirname, "../../split_output");
    const bucket = S3_BUCKET_NAME;
    const results = {
      successful: [] as string[],
      failed: [] as { name: string; error: string }[],
    };

    try {
      const clients = await fs.readdir(splitOutputRoot, {
        withFileTypes: true,
      });
      const clientDirs = clients.filter(
        (d) => d.isDirectory() && d.name.startsWith("CLIENT_CODE_")
      );

      if (clientDirs.length === 0) {
        return res.status(200).json({
          statusCode: 200,
          message: "No client directories found to upload.",
        });
      }

      for (const clientDir of clients) {
        if (
          clientDir.isDirectory() &&
          clientDir.name.startsWith("CLIENT_CODE_")
        ) {
          const clientPath = path.join(splitOutputRoot, clientDir.name);
          const s3Prefix = getS3SplitPrefix(clientDir.name);
          console.log(
            `Uploading SpitFiles for ${clientDir.name} → s3://${bucket}/${s3Prefix}`
          );
          try {
            await uploadSplitFilesToS3(clientPath, bucket, s3Prefix);
            results.successful.push(clientDir.name);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            console.error(`S3 upload error for ${clientDir.name}:`, error);
            results.failed.push({ name: clientDir.name, error: errorMessage });
          }
        }
      }
      if (results.failed.length > 0) {
        return res.status(500).json({
          statusCode: 500,
          message: "S3 upload process completed with one or more failures.",
          ...results,
        });
      }

      res.status(200).json({
        statusCode: 200,
        message: "All split files uploaded to S3 successfully.",
        ...results,
      });
    } catch (error) {
      // This outer catch handles errors like `fs.readdir` failing
      console.error("General S3 upload process error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "A critical error occurred during the S3 upload process.",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async listS3Files(req: Request, res: Response) {
    try {
      const prefix = req.query.prefix as string;
      if (!prefix) {
        return res
          .status(400)
          .json({ statusCode: 400, error: "Prefix is required" });
      }
      const files = await listFiles(prefix);
      res.status(200).json({ statusCode: 200, files });
    } catch (error) {
      console.error("S3 list error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Failed to list S3 files",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async deleteS3Files(req: Request, res: Response) {
    try {
      const { keys } = req.body;
      if (!keys || !Array.isArray(keys) || keys.length === 0) {
        return res
          .status(400)
          .json({ statusCode: 400, error: "File keys are required" });
      }
      const deletedKeys = await deleteFiles(keys);
      res.status(200).json({
        statusCode: 200,
        message: "Files deleted successfully",
        deletedKeys,
      });
    } catch (error) {
      console.error("S3 delete error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Failed to delete S3 files",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export const fileController = new FileController();
