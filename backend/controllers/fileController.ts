import { Request, Response } from "express";
import { spawn } from "child_process";
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
import {
  listFiles,
  deleteFiles,
  searchFiles,
  searchFolders,
} from "../services/s3Manager";
import logger from "../utils/logger";

class FileController {
  async processExcelFile(req: Request, res: Response) {
    try {
      logger.info({
        category: "api-calls",
        function: "processExcelFile",
        message: `Initiating Excel file processing for: ${req.file?.originalname}`,
      });
      if (!req.file) {
        logger.warn({
          category: "api-calls",
          function: "processExcelFile",
          message: "No file uploaded for Excel processing.",
        });
        return res
          .status(400)
          .json({ statusCode: 400, error: "No file uploaded" });
      }
      const processor = new PdfProcessing();
      const result = await processor.processExcelFile(req.file.path);
      logger.debug({
        category: "responses",
        function: "processExcelFile",
        message: "Excel file processed successfully",
        originalFile: req.file.originalname,
        processedFile: result.outputFileName,
      });
      res.status(200).json({
        statusCode: 200,
        message: "File processed successfully",
        originalFile: req.file!.originalname,
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
      logger.error({
        category: "api-calls",
        function: "processExcelFile",
        message: "Failed to process Excel file",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
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
      logger.info({
        category: "api-calls",
        function: "downloadFile",
        message: `Initiating download for file: ${filename}`,
      });
      const filePath = path.join("processed", filename);
      if (
        !(await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false))
      ) {
        logger.warn({
          category: "api-calls",
          function: "downloadFile",
          message: `File not found for download: ${filename}`,
        });
        return res
          .status(404)
          .json({ statusCode: 404, error: "File not found" });
      }
      res.setHeader("Content-Type", "text/csv"); // Set for CSV
      res.download(filePath, filename, (err) => {
        if (err) {
          logger.error({
            category: "api-calls",
            function: "downloadFile",
            message: `Failed to download file: ${filename}`,
            error: err.message,
            stack: err.stack,
          });
          // If headers were already sent, we can't send a new JSON response, so just log.
          if (!res.headersSent) {
            res.status(500).json({
              statusCode: 500,
              error: "Failed to download file",
              details: err.message,
            });
          }
        } else {
          logger.info({
            category: "api-calls",
            function: "downloadFile",
            message: `File downloaded successfully: ${filename}`,
          });
        }
      });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "downloadFile",
        message: "Failed to initiate file download",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
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
      logger.info({
        category: "api-calls",
        function: "downloadReferencedFile",
        message: `Initiating download for referenced file: ${filePath}`,
      });
      if (
        !(await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false))
      ) {
        logger.warn({
          category: "api-calls",
          function: "downloadReferencedFile",
          message: `Referenced file not found for download: ${filePath}`,
        });
        return res
          .status(404)
          .json({ statusCode: 404, error: "File not found" });
      }
      res.download(filePath, path.basename(filePath), (err) => {
        if (err) {
          logger.error({
            category: "api-calls",
            function: "downloadReferencedFile",
            message: `Failed to download referenced file: ${filePath}`,
            error: err.message,
            stack: err.stack,
          });
          if (!res.headersSent) {
            res.status(500).json({
              statusCode: 500,
              error: "Failed to download file",
              details: err.message,
            });
          }
        } else {
          logger.info({
            category: "api-calls",
            function: "downloadReferencedFile",
            message: `Referenced file downloaded successfully: ${filePath}`,
          });
        }
      });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "downloadReferencedFile",
        message: "Failed to initiate referenced file download",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to download file",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async splitFiles(req: Request, res: Response) {
    try {
      logger.info({
        category: "api-calls",
        function: "splitFiles",
        message: "Initiating file splitting process.",
      });
      const processor = new Splitting();
      const result = await processor.splitFiles();
      logger.debug({
        category: "responses",
        function: "splitFiles",
        message: "Files split successfully",
        splitSummary: result.summary,
      });
      res.status(200).json({
        statusCode: 200,
        message: "Files split successfully",
        splitSummary: result.summary,
        splitFiles: result.splitFiles,
      });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "splitFiles",
        message: "Failed to split files",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to split files",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async splitFilesWithMuPDF(req: Request, res: Response) {
    try {
      logger.info({
        category: "api-calls",
        function: "splitFilesWithMuPDF",
        message: "Initiating file splitting process with MuPDF.",
      });
      const processor = new Splitting();
      const result = await processor.splitFilesWithMuPDF();
      logger.debug({
        category: "responses",
        function: "splitFilesWithMuPDF",
        message: "Files split successfully with MuPDF",
        splitSummary: result.summary,
      });
      res.status(200).json({
        statusCode: 200,
        message: "Files split successfully with MuPDF",
        splitSummary: result.summary,
        splitFiles: result.splitFiles,
      });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "splitFilesWithMuPDF",
        message: "Failed to split files with MuPDF",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to split files with MuPDF",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async generateSql(req: Request, res: Response) {
    try {
      logger.info({
        category: "api-calls",
        function: "generateSql",
        message: "Initiating SQL generation.",
      });
      const processor = new Database();
      const result = await processor.generateSql(); // Call new method in pdfProcessor.ts
      logger.info({
        category: "api-calls",
        function: "generateSql",
        message: "SQL generated successfully",
      });
      res.status(200).json({
        statusCode: 200,
        message: "SQL generated successfully",
        sql: result.sql,
      });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "generateSql",
        message: "Failed to generate SQL",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to generate SQL",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async processSqlMongo(req: Request, res: Response) {
    const { action, updateAll } = req.body;
    const database = new Database();

    if (action === "executeSql") {
      logger.info({
        category: "api-calls",
        function: "processSqlMongo",
        action: "executeSql",
        message: "Initiating SQL execution.",
      });
      const { result, summary } = await database.executeSql();
      if (result === "success") {
        logger.debug({
          category: "responses",
          function: "processSqlMongo",
          action: "executeSql",
          message: "SQL executed successfully",
          summary,
        });
        return res.json({
          message: "SQL executed successfully",
          totalRows: summary.insertedRows + summary.errorRows,
          successfulRows: summary.insertedRows,
          badRows: summary.errorRows,
          badRowsFilePath: summary.badRowsFilePath,
        });
      } else {
        logger.error({
          category: "api-calls",
          function: "processSqlMongo",
          action: "executeSql",
          message: "Failed to execute SQL",
          summary,
        });
        return res.status(500).json({
          message: "Failed to execute SQL",
          totalRows: summary.insertedRows + summary.errorRows,
          successfulRows: summary.insertedRows,
          badRows: summary.errorRows,
          badRowsFilePath: summary.badRowsFilePath,
        });
      }
    } else if (action === "updateFolioAndTransaction") {
      logger.info({
        category: "api-calls",
        function: "processSqlMongo",
        action: "updateFolioAndTransaction",
        message: `Initiating Folio and Transaction update (updateAll: ${updateAll}).`,
      });
      const { result, summary } = await database.updateFolioAndTransaction(
        updateAll
      );
      if (result === "success") {
        logger.debug({
          category: "responses",
          function: "processSqlMongo",
          action: "updateFolioAndTransaction",
          message: "Folio and Transaction updated successfully",
          summary,
        });
        return res.json({
          message: "Folio and Transaction updated successfully",
          updatedFolioRows: summary.updatedFolioRows,
          updatedTransactionRows: summary.updatedTransactionRows,
          badRows: summary.badRows.length,
          badRowsFilePath: summary.badRowsFilePath,
        });
      } else {
        logger.error({
          category: "api-calls",
          function: "processSqlMongo",
          action: "updateFolioAndTransaction",
          message: "Failed to update Folio and Transaction",
          summary,
        });
        return res.status(500).json({
          message: "Failed to update Folio and Transaction",
          updatedFolioRows: summary.updatedFolioRows,
          updatedTransactionRows: summary.updatedTransactionRows,
          badRows: summary.badRows.length,
          badRowsFilePath: summary.badRowsFilePath,
        });
      }
    } else {
      logger.warn({
        category: "api-calls",
        function: "processSqlMongo",
        message: `Invalid action provided: ${action}`,
      });
      return res.status(400).json({ message: "Invalid action" });
    }
  }

  async executeSql(req: Request, res: Response) {
    try {
      logger.info({
        category: "api-calls",
        function: "executeSql",
        message: "Initiating standalone SQL execution.",
      });
      const processor = new Database();
      const result = await processor.executeSql();
      logger.debug({
        category: "responses",
        function: "executeSql",
        message: `Standalone SQL execution ${result.result}`,
        result: result.result,
        summary: result.summary,
      });
      res.status(200).json({
        statusCode: 200,
        message:
          result.result === "success"
            ? "SQL executed successfully"
            : "SQL execution failed",
        result: result.result,
        logs: result.logs,
        summary: result.summary,
      });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "executeSql",
        message: "Failed to execute standalone SQL",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to execute SQL",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async updateFolioAndTransaction(req: Request, res: Response) {
    try {
      const { updateAll } = req.body;
      logger.info({
        category: "api-calls",
        function: "updateFolioAndTransaction",
        message: `Initiating standalone Folio and Transaction update (updateAll: ${updateAll}).`,
      });
      const processor = new Database();
      const result = await processor.updateFolioAndTransaction(updateAll);
      logger.debug({
        category: "responses",
        function: "updateFolioAndTransaction",
        message: `Standalone Folio and Transaction update ${result.result}`,
        result: result.result,
        summary: result.summary,
      });
      res.status(200).json({
        statusCode: 200,
        message:
          result.result === "success"
            ? "Folio_id updated successfully"
            : "Folio_id update failed",
        result: result.result,
        logs: result.logs,
        summary: result.summary,
      });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "updateFolioAndTransaction",
        message: "Failed to update standalone Folio and Transaction",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to run updateFolioAndTransaction()",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async checkMongoDuplicates(req: Request, res: Response) {
    try {
      const { dryRun, cutoffTms } = req.body;
      logger.info({
        category: "api-calls",
        function: "checkMongoDuplicates",
        message: `Initiating Mongo duplicate check (dryRun: ${dryRun}, cutoffTms: ${cutoffTms}).`,
      });
      const mongoDatabase = new MongoDatabase();
      const result = await mongoDatabase.sanityCheckMongoDuplicates({
        dryRun,
        cutoffTms,
      });
      logger.debug({
        category: "responses",
        function: "checkMongoDuplicates",
        message: "Mongo duplicate check completed successfully",
        result,
      });
      res.status(200).json({ statusCode: 200, ...result });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "checkMongoDuplicates",
        message: "Failed to run Mongo duplicate check",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to run Mongo sanity check",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async sanityCheckDuplicates(req: Request, res: Response) {
    try {
      const { cutoffTms, dryRun, normalize, clientCode } = req.body;
      logger.info({
        category: "api-calls",
        function: "sanityCheckDuplicates",
        message: `Initiating sanity check for duplicates (cutoffTms: ${cutoffTms}, dryRun: ${dryRun}, normalize: ${normalize}, clientCode: ${clientCode}).`,
      });
      const processor = new Database();
      const result = await processor.sanityCheckDuplicates({
        dryRun,
        normalize,
        cutoffTms,
        clientCode,
      });

      if (result.result === "failed") {
        const errorMessage =
          result.logs.length > 0
            ? result.logs[0].message
            : "Sanity check failed with an unspecified error.";
        logger.error({
          category: "api-calls",
          function: "sanityCheckDuplicates",
          message: "Sanity check failed",
          details: errorMessage,
          result,
        });
        return res.status(500).json({
          statusCode: 500,
          error: "Sanity check failed",
          details: errorMessage,
        });
      }

      logger.debug({
        category: "responses",
        function: "sanityCheckDuplicates",
        message: "Sanity check completed successfully",
        result,
      });
      res.status(200).json({ statusCode: 200, ...result });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "sanityCheckDuplicates",
        message: "Sanity check error (exception caught)",
        error:
          error instanceof Error ? error.message : "Unknown unexpected error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to run sanity check due to an unexpected error",
        details:
          error instanceof Error ? error.message : "Unknown unexpected error",
      });
    }
  }

  async transferDataToMongo(req: Request, res: Response) {
    try {
      const { clientCode } = req.body;
      logger.info({
        category: "api-calls",
        function: "transferDataToMongo",
        message: `Initiating data transfer to MongoDB for clientCode: ${clientCode || 'all'}.`,
      });
      const mongoDatabase = new MongoDatabase();
      const result = await mongoDatabase.transferDataFromPostgres(clientCode);
      logger.debug({
        category: "responses",
        function: "transferDataToMongo",
        message: `Transferred ${result.transferredCount} documents to MongoDB successfully.`,
        transferredCount: result.transferredCount,
      });
      res.status(200).json({
        statusCode: 200,
        message: `Transferred ${result.transferredCount} documents to MongoDB successfully.`,
        transferredCount: result.transferredCount,
        documents: result.documents, // Include the documents array
      });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "transferDataToMongo",
        message: "Failed to transfer data to MongoDB",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to transfer data to MongoDB",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async updateMongoTransactions(req: Request, res: Response) {
    try {
      const { clientCode: rawClientCode } = req.body;
      const clientCode = rawClientCode ? rawClientCode.trim() : undefined;
      logger.info({
        category: "api-calls",
        function: "updateMongoTransactions",
        message: `Initiating Mongo transactions update for clientCode: ${clientCode || 'all'}.`,
      });

      const database = new Database(); // Instantiate Database service
      let clientId: number | undefined;

      if (clientCode) {
        const clientRes = await database.getClientIdByCode(clientCode);
        if (!clientRes) {
          logger.warn({
            category: "api-calls",
            function: "updateMongoTransactions",
            message: `Client code '${clientCode}' not found in PostgreSQL. Aborting Mongo transaction update.`,
          });
          return res.status(404).json({
            statusCode: 404,
            error: `Client code '${clientCode}' not found.`,
          });
        }
        clientId = clientRes.id;
      }

      const mongoDatabase = new MongoDatabase();
      const result = await mongoDatabase.updateMongoTransactions(clientId);
      logger.debug({
        category: "responses",
        function: "updateMongoTransactions",
        message: "Mongo transactions updated successfully.",
        result,
      });
      res.status(200).json({
        statusCode: 200,
        message: "Mongo transactions updated successfully.",
        ...result,
      });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "updateMongoTransactions",
        message: "Failed to update Mongo transactions",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to update Mongo transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async uploadToS3(req: Request, res: Response) {
    try {
      const outputRoot = path.join(__dirname, "../../output");
      const bucket = S3_BUCKET_NAME; // Using centralized config

      const clients = await fs.readdir(outputRoot, { withFileTypes: true });
      const clientDirs = clients.filter(
        (d) => d.isDirectory() && d.name.startsWith("CLIENT_CODE_")
      );

      if (clientDirs.length === 0) {
        return res.status(200).json({
          statusCode: 200,
          message: "No client directories found in output folder to upload.",
        });
      }

      // Await the upload process to get final counts
      const uploadResults = await Promise.all(
        clientDirs.map(async (clientDir) => {
          const clientPath = path.join(outputRoot, clientDir.name);
          const s3Prefix = getS3FilePrefix(clientDir.name);
          logger.info({
            category: "task-steps",
            function: "uploadToS3",
            message: `Uploading ${clientDir.name} → s3://${bucket}/${s3Prefix}`,
          });
          try {
            return await uploadDirectoryRecursive(clientPath, bucket, s3Prefix);
          } catch (error) {
            logger.error({
              category: "task-steps",
              function: "uploadToS3",
              message: `S3 upload error for ${clientDir.name}`,
              error: error instanceof Error ? error.message : "Unknown error",
              stack: error instanceof Error ? error.stack : undefined,
            });
            return {
              successfulFilesCount: 0,
              failedFilesCount: 1,
              failedFileDetails: [
                {
                  name: clientDir.name,
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                },
              ],
            };
          }
        })
      );

      const totalSuccessfulFiles = uploadResults.reduce(
        (sum, res) => sum + res.successfulFilesCount,
        0
      );
      const totalFailedFiles = uploadResults.reduce(
        (sum, res) => sum + res.failedFilesCount,
        0
      );

      const message =
        totalFailedFiles > 0
          ? `S3 upload completed: ${totalSuccessfulFiles} Successful - ${totalFailedFiles} Failed`
          : `S3 upload completed successfully. Total files uploaded: ${totalSuccessfulFiles}.`;

      res.status(200).json({
        statusCode: 200,
        message: message,
        successfulFilesCount: totalSuccessfulFiles,
        failedFilesCount: totalFailedFiles,
      });
    } catch (error: any) {
      const errorMessage =
        error.message && error.message.includes("expired credentials")
          ? "S3 upload failed: Authentication token expired. Please refresh your credentials."
          : error instanceof Error
          ? error.message
          : "Unknown error";
      logger.error({
        category: "api-calls",
        function: "uploadToS3",
        message: "Failed to initiate S3 upload",
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      // If an error occurs before sending the initial 200 response, send a 500.
      if (!res.headersSent) {
        res.status(500).json({
          statusCode: 500,
          error: "Failed to initiate S3 upload",
          details: errorMessage,
        });
      }
    }
  }

  async uploadSplitFilesToS3(req: Request, res: Response) {
    const splitOutputRoot = path.join(__dirname, "../../split_output");
    const bucket = S3_BUCKET_NAME;

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

      // Await the upload process to get final counts
      const uploadResults = await Promise.all(
        clientDirs.map(async (clientDir) => {
          const clientPath = path.join(splitOutputRoot, clientDir.name);
          const s3Prefix = getS3SplitPrefix(clientDir.name);
          logger.info({
            category: "task-steps",
            function: "uploadSplitFilesToS3",
            message: `Uploading SplitFiles for ${clientDir.name} → s3://${bucket}/${s3Prefix}`,
          });
          try {
            return await uploadSplitFilesToS3(clientPath, bucket, s3Prefix);
          } catch (error) {
            logger.error({
              category: "task-steps",
              function: "uploadSplitFilesToS3",
              message: `S3 upload error for ${clientDir.name}`,
              error: error instanceof Error ? error.message : "Unknown error",
              stack: error instanceof Error ? error.stack : undefined,
            });
            return {
              successfulFilesCount: 0,
              failedFilesCount: 1,
              failedFileDetails: [
                {
                  name: clientDir.name,
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                },
              ],
            };
          }
        })
      );

      const totalSuccessfulFiles = uploadResults.reduce(
        (sum, res) => sum + res.successfulFilesCount,
        0
      );
      const totalFailedFiles = uploadResults.reduce(
        (sum, res) => sum + res.failedFilesCount,
        0
      );

      const message =
        totalFailedFiles > 0
          ? `S3 split files upload completed: ${totalSuccessfulFiles} Successful and ${totalFailedFiles} Failed`
          : `S3 split files upload completed successfully. Total files uploaded: ${totalSuccessfulFiles}.`;

      res.status(200).json({
        statusCode: 200,
        message: message,
        successfulFilesCount: totalSuccessfulFiles,
        failedFilesCount: totalFailedFiles,
      });
    } catch (error: any) {
      // This outer catch handles errors like `fs.readdir` failing
      const errorMessage =
        error.message && error.message.includes("expired credentials")
          ? "S3 upload process failed: Authentication token expired. Please refresh your credentials."
          : error instanceof Error
          ? error.message
          : "Unknown error";
      logger.error({
        category: "api-calls",
        function: "uploadSplitFilesToS3",
        message: "Failed to initiate S3 split files upload",
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      // If an error occurs before sending the initial 200 response, send a 500.
      if (!res.headersSent) {
        res.status(500).json({
          statusCode: 500,
          error: "A critical error occurred during the S3 upload process.",
          details: errorMessage,
        });
      }
    }
  }
  async listS3Files(req: Request, res: Response) {
    try {
      const prefix = (req.query.prefix as string) || "";
      const continuationToken = req.query.continuationToken as
        | string
        | undefined;
      logger.info({
        category: "api-calls",
        function: "listS3Files",
        message: `Initiating S3 file listing for prefix: ${prefix}`,
      });
      const data = await listFiles(prefix, continuationToken);
      logger.debug({
        category: "responses",
        function: "listS3Files",
        message: "S3 files listed successfully",
        count: data.files.length + data.directories.length,
      });
      res.status(200).json({ statusCode: 200, ...data });
    } catch (error: any) {
      const errorMessage =
        error.message && error.message.includes("expired credentials")
          ? "S3 operation failed: Authentication token expired. Please refresh your credentials."
          : error instanceof Error
          ? error.message
          : "Unknown error";
      logger.error({
        category: "api-calls",
        function: "listS3Files",
        message: "Failed to list S3 files",
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to list S3 files",
        details: errorMessage,
      });
    }
  }

  async deleteS3Files(req: Request, res: Response) {
    try {
      const { keys } = req.body;
      logger.info({
        category: "api-calls",
        function: "deleteS3Files",
        message: `Initiating S3 file deletion for ${keys.length} keys.`,
      });
      if (!keys || !Array.isArray(keys) || keys.length === 0) {
        logger.warn({
          category: "api-calls",
          function: "deleteS3Files",
          message: "File keys are required for S3 deletion.",
        });
        return res
          .status(400)
          .json({ statusCode: 400, error: "File keys are required" });
      }
      const deletedKeys = await deleteFiles(keys);
      logger.debug({
        category: "responses",
        function: "deleteS3Files",
        message: `S3 files deleted successfully`,
        deletedCount: deletedKeys.length,
      });
      res.status(200).json({
        statusCode: 200,
        message: "Files deleted successfully",
        deletedKeys,
      });
    } catch (error: any) {
      const errorMessage =
        error.message && error.message.includes("expired credentials")
          ? "S3 operation failed: Authentication token expired. Please refresh your credentials."
          : error instanceof Error
          ? error.message
          : "Unknown error";
      logger.error({
        category: "api-calls",
        function: "deleteS3Files",
        message: "Failed to delete S3 files",
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to delete S3 files",
        details: errorMessage,
      });
    }
  }

  async searchS3Files(req: Request, res: Response) {
    try {
      const currentBrowsingPrefix = (req.query.prefix as string) || "";
      const transactionNumberPattern =
        (req.query.transactionNumberPattern as string) || "d+";
      const filenamePattern = (req.query.filenamePattern as string) || ".*"; // Default to '.*' for global file search

      const continuationToken = req.query.continuationToken as
        | string
        | undefined;

      let files: { key: string; lastModified: Date | undefined }[] = [];
      let directories: string[] = [];
      let nextContinuationToken: string | undefined;

      const isTransactionPatternProvided = transactionNumberPattern !== "d+";
      const isFilenamePatternProvided = filenamePattern !== ".*";

      logger.info({
        category: "api-calls",
        function: "searchS3Files",
        message: "--- searchS3Files Debug Start ---",
      });
      logger.debug({
        category: "app-flow",
        function: "searchS3Files",
        context: {
          currentBrowsingPrefix,
          transactionNumberPattern,
          filenamePattern,
          continuationToken,
          isTransactionPatternProvided,
          isFilenamePatternProvided,
        },
        message: "Input parameters and derived flags",
      });

      if (!isTransactionPatternProvided && !isFilenamePatternProvided) {
        logger.debug({
          category: "app-flow",
          function: "searchS3Files",
          message:
            "Logic Branch: No search patterns provided (normal list operation).",
        });
        const listResult = await listFiles(
          currentBrowsingPrefix,
          continuationToken
        );
        logger.debug({
          category: "app-flow",
          function: "searchS3Files",
          message: `listFiles result (no patterns) - directories: ${listResult.directories.length}, files: ${listResult.files.length}`,
        });
        directories = listResult.directories;
        files = listResult.files;
        nextContinuationToken = listResult.nextContinuationToken;
      } else if (isTransactionPatternProvided && !isFilenamePatternProvided) {
        logger.debug({
          category: "app-flow",
          function: "searchS3Files",
          message:
            "Logic Branch: transactionNumberPattern provided, filenamePattern not (filtered folder display).",
        });
        let allDirectories: string[] = [];
        let currentContinuationToken: string | undefined = continuationToken;

        do {
          const listResult = await listFiles(
            currentBrowsingPrefix,
            currentContinuationToken
          );
          logger.debug({
            category: "app-flow",
            function: "searchS3Files",
            message:
              "listFiles result (transaction pattern) - raw directories (page)",
            directories: listResult.directories,
          });
          allDirectories = allDirectories.concat(listResult.directories);
          logger.debug({
            category: "app-flow",
            function: "searchS3Files",
            message: `Accumulated allDirectories (current count): ${allDirectories.length}`,
            content: allDirectories,
          });
          currentContinuationToken = listResult.nextContinuationToken;
          logger.debug({
            category: "app-flow",
            function: "searchS3Files",
            message: `Next ContinuationToken for transaction pattern search: ${currentContinuationToken}`,
          });
        } while (currentContinuationToken);

        const transactionRegex = new RegExp(
          `^${currentBrowsingPrefix}CLIENT_CODE_\\d+_TRANSACTION_NUMBER_${transactionNumberPattern}`
        );
        logger.debug({
          category: "app-flow",
          function: "searchS3Files",
          message: `Constructed transactionRegex: ${transactionRegex.source}`,
        });
        directories = allDirectories.filter((dir) =>
          transactionRegex.test(dir)
        );
        logger.debug({
          category: "app-flow",
          function: "searchS3Files",
          message: `Filtered directories (by transactionRegex): ${directories.length}`,
        });
        files = []; // No individual files displayed at this level, only folders
        nextContinuationToken = undefined; // All results fetched by looping
      } else if (!isTransactionPatternProvided && isFilenamePatternProvided) {
        logger.debug({
          category: "app-flow",
          function: "searchS3Files",
          message:
            "Logic Branch: filenamePattern provided, transactionNumberPattern not (global file search, extract folders).",
        });
        const s3CommandPrefix = ""; // Global search
        const fileSearchRegex = `^${currentBrowsingPrefix}.*CLIENT_CODE_\\d+_TRANSACTION_NUMBER_\\d+/${filenamePattern}`;
        logger.debug({
          category: "app-flow",
          function: "searchS3Files",
          message: `Constructed fileSearchRegex (global): ${fileSearchRegex}`,
        });
        const allMatchedFiles = await searchFiles(
          s3CommandPrefix,
          fileSearchRegex
        );
        logger.debug({
          category: "app-flow",
          function: "searchS3Files",
          message: `searchFiles result (global) - matched files: ${allMatchedFiles.files.length}`,
        });

        const uniqueTransactionFolders = new Set<string>();
        allMatchedFiles.files.forEach((file) => {
          const match = file.key.match(
            /(CLIENT_CODE_\\d+_TRANSACTION_NUMBER_\\d+\/)/
          );
          if (match) {
            const fullTransactionFolderPath = currentBrowsingPrefix + match[1];
            uniqueTransactionFolders.add(fullTransactionFolderPath);
          }
        });
        directories = Array.from(uniqueTransactionFolders).sort();
        logger.debug({
          category: "app-flow",
          function: "searchS3Files",
          message: `Extracted unique transaction folders: ${directories.length}`,
        });
        files = []; // No individual files displayed at this level, only folders
        nextContinuationToken = undefined; // All results fetched by searchFiles
      } else {
        logger.debug({
          category: "app-flow",
          function: "searchS3Files",
          message:
            "Logic Branch: Both transactionNumberPattern and filenamePattern provided (specific file search).",
        });
        const s3CommandPrefix = ""; // Global search
        const clientCodeMatch =
          currentBrowsingPrefix.match(/CLIENT_CODE_(\d+)/);
        const clientCode = clientCodeMatch ? clientCodeMatch[1] : "d+";
        logger.debug({
          category: "app-flow",
          function: "searchS3Files",
          message: `Derived clientCode for specific search: ${clientCode}`,
        });

        const transactionPart = `CLIENT_CODE_${clientCode}_TRANSACTION_NUMBER_${transactionNumberPattern}`;
        const fileSearchRegex = `^${currentBrowsingPrefix}${transactionPart}/${filenamePattern}`;
        logger.debug({
          category: "app-flow",
          function: "searchS3Files",
          message: `Constructed fileSearchRegex (specific): ${fileSearchRegex}`,
        });

        const allMatchedFiles = await searchFiles(
          s3CommandPrefix,
          fileSearchRegex
        );
        logger.debug({
          category: "app-flow",
          function: "searchS3Files",
          message: `searchFiles result (specific) - matched files: ${allMatchedFiles.files.length}`,
        });
        files = allMatchedFiles.files;
        directories = [];
        nextContinuationToken = undefined;
      }

      logger.debug({
        category: "app-flow",
        function: "searchS3Files",
        message: `Final Response - directories count: ${directories.length}, files count: ${files.length}`,
      });
      logger.info({
        category: "api-calls",
        function: "searchS3Files",
        message: "--- searchS3Files Debug End ---",
      });
      res
        .status(200)
        .json({ statusCode: 200, files, directories, nextContinuationToken });
    } catch (error: any) {
      const errorMessage =
        error.message && error.message.includes("expired credentials")
          ? "S3 operation failed: Authentication token expired. Please refresh your credentials."
          : error instanceof Error
          ? error.message
          : "Unknown error";
      logger.error({
        category: "api-calls",
        function: "searchS3Files",
        message: "Failed to search S3 files",
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to search S3 files",
        details: errorMessage,
      });
    }
  }

  async searchS3Folders(req: Request, res: Response) {
    try {
      const prefix = (req.query.prefix as string) || "";
      const pattern = (req.query.pattern as string) || "";
      const continuationToken = req.query.continuationToken as
        | string
        | undefined;
      logger.info({
        category: "api-calls",
        function: "searchS3Folders",
        message: `Initiating S3 folder search for prefix: ${prefix}, pattern: ${pattern}`,
      });
      const data = await searchFolders(prefix, pattern, continuationToken);
      logger.debug({
        function: "searchS3Folders",
        message: "S3 folders searched successfully",
        count: data.directories.length,
      });
      res.status(200).json({ statusCode: 200, ...data });
    } catch (error: any) {
      const errorMessage =
        error.message && error.message.includes("expired credentials")
          ? "S3 operation failed: Authentication token expired. Please refresh your credentials."
          : error instanceof Error
          ? error.message
          : "Unknown error";
      logger.error({
        category: "api-calls",
        function: "searchS3Folders",
        message: "Failed to search S3 folders",
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to search S3 folders",
        details: errorMessage,
      });
    }
  }
  async getMongoDocumentsByDate(req: Request, res: Response) {
    try {
      const dateString = req.query.date as string;
      logger.info({
        category: "api-calls",
        function: "getMongoDocumentsByDate",
        message: `Initiating Mongo document fetch by date: ${dateString}`,
      });

      if (!dateString) {
        logger.warn({
          category: "api-calls",
          function: "getMongoDocumentsByDate",
          message: "Date query parameter is required.",
        });
        return res.status(400).json({
          statusCode: 400,
          error: "Date query parameter is required.",
        });
      }

      const filterDate = new Date(dateString);

      if (isNaN(filterDate.getTime())) {
        logger.warn({
          category: "api-calls",
          function: "getMongoDocumentsByDate",
          message: `Invalid date format provided: ${dateString}`,
        });
        return res.status(400).json({
          statusCode: 400,
          error:
            "Invalid date format provided. Please use ISO 8601 format (e.g., 'YYYY-MM-DDTHH:mm:ss.SSSZ').",
        });
      }

      const mongoDatabase = new MongoDatabase();
      const documents = await mongoDatabase.getDocumentsCreatedAfterDate(
        filterDate
      );

      logger.debug({
        function: "getMongoDocumentsByDate",
        message: `Successfully fetched ${
          documents.length
        } documents created after ${filterDate.toISOString()}`,
      });
      res.status(200).json({
        statusCode: 200,
        message: `Successfully fetched documents created after ${filterDate.toISOString()}`,
        count: documents.length,
        documents,
      });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "getMongoDocumentsByDate",
        message: "Failed to fetch Mongo documents by date",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to fetch Mongo documents by date",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async reconnect(req: Request, res: Response) {
    try {
      logger.info({
        category: "api-calls",
        function: "reconnect",
        message: "Initiating database reconnection.",
      });
      const database = new Database();
      await database.reconnect();
      logger.info({
        category: "api-calls",
        function: "reconnect",
        message: "Database reconnected successfully",
      });
      res.status(200).json({
        statusCode: 200,
        message: "Database reconnected successfully",
      });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "reconnect",
        message: "Failed to reconnect to the database",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to reconnect to the database",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async downloadGeneratedFile(req: Request, res: Response) {
    try {
      const filename = req.params.filename;
      logger.info({
        category: "api-calls",
        function: "downloadGeneratedFile",
        message: `Initiating download for generated file: ${filename}`,
      });
      const filePath = path.join(__dirname, "../../logs", filename);

      // Security check: Ensure the file is within the intended directory
      const resolvedPath = path.resolve(filePath);
      const expectedDir = path.resolve(path.join(__dirname, "../../logs"));

      if (!resolvedPath.startsWith(expectedDir)) {
        logger.warn({
          category: "api-calls",
          function: "downloadGeneratedFile",
          message: `Access denied for file outside logs directory: ${filename}`,
        });
        return res
          .status(403)
          .json({ statusCode: 403, error: "Access denied." });
      }

      if (
        !(await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false))
      ) {
        logger.warn({
          category: "api-calls",
          function: "downloadGeneratedFile",
          message: `Generated file not found for download: ${filename}`,
        });
        return res
          .status(404)
          .json({ statusCode: 404, error: "File not found" });
      }
      res.download(filePath, filename, (err) => {
        if (err) {
          logger.error({
            category: "api-calls",
            function: "downloadGeneratedFile",
            message: `Failed to download generated file: ${filename}`,
            error: err.message,
            stack: err.stack,
          });
          if (!res.headersSent) {
            res.status(500).json({
              statusCode: 500,
              error: "Failed to download file",
              details: err.message,
            });
          }
        } else {
          logger.info({
            category: "api-calls",
            function: "downloadGeneratedFile",
            message: `Generated file downloaded successfully: ${filename}`,
          });
        }
      });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "downloadGeneratedFile",
        message: "Failed to initiate generated file download",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to download file",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async runFallback(req: Request, res: Response) {
    try {
      if (!req.file) {
        logger.warn({
          category: "api-calls",
          function: "runFallback",
          message: "No file uploaded for fallback processing.",
        });
        return res
          .status(400)
          .json({ statusCode: 400, error: "No file uploaded" });
      }
      logger.info({
        category: "api-calls",
        function: "runFallback",
        message: `Running fallback for file: ${req.file!.originalname}`,
      });

      const pythonScriptPath = path.resolve(
        __dirname,
        "..",
        "..",
        "services",
        "fallback_processor.py"
      );
      const excelFilePath = req.file!.path;
      const pythonExecutable = process.env.PYTHON_EXECUTABLE_PATH || "python";

      const childProcess = spawn(pythonExecutable, [
        pythonScriptPath,
        excelFilePath,
      ]);

      childProcess.stdout.on("data", (data) => {
        logger.debug({
          category: "task-steps",
          function: "runFallback",
          message: `Fallback script stdout: ${data.toString().trim()}`,
        });
      });

      childProcess.stderr.on("data", (data) => {
        logger.error({
          category: "task-steps",
          function: "runFallback",
          message: `Fallback script stderr: ${data.toString().trim()}`,
        });
      });

      childProcess.on("close", (code) => {
        if (code === 0) {
          logger.debug({
            function: "runFallback",
            message: "Fallback process completed successfully",
            originalFile: req.file!.originalname,
          });
          res.status(200).json({
            statusCode: 200,
            message: "Fallback process completed successfully",
            originalFile: req.file!.originalname,
          });
        } else {
          logger.error({
            category: "api-calls",
            function: "runFallback",
            message: `Fallback script exited with code ${code}`,
            originalFile: req.file!.originalname,
          });
          res.status(500).json({
            statusCode: 500,
            error: `Fallback script exited with code ${code}`,
          });
        }
      });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "runFallback",
        message: "Fallback processing error",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to process fallback",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export const fileController = new FileController();
