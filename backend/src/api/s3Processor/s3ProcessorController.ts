import { Request, Response } from "express";
import fs from "fs/promises";
import logger from "../../utils/logger";
import {
  uploadDirectoryRecursive,
  uploadSplitFilesToS3,
  uploadOriginalToS3,
} from "./s3Uploader";
import {
  listFiles,
  deleteFiles,
  searchFiles,
  searchFolders,
} from "./s3Manager";
import path from "path";
import {
  S3_BUCKET_NAME,
  getS3FilePrefix,
  getS3SplitPrefix,
} from "../../utils/s3Config";
import { broadcast } from "../../utils/webSocketService";

type S3UploadResult = {
  successfulFilesCount: number;
  failedFilesCount: number;
  failedFileDetails?: { name: string; error: string }[];
};

class S3ProcessorController {
  private createUploadJobId(context: string): string {
    return `${context}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }

  private getBoundedNumber(
    value: unknown,
    fallback: number,
    min: number,
    max: number
  ): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(parsed)));
  }

  private emitS3Progress(payload: Record<string, unknown>) {
    try {
      broadcast(JSON.stringify(payload));
    } catch (error) {
      logger.error({
        category: "task-steps",
        function: "emitS3Progress",
        message: "Failed to broadcast S3 progress",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async runWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;

    const workers = Array.from(
      { length: Math.min(concurrency, items.length) },
      async () => {
        while (nextIndex < items.length) {
          const currentIndex = nextIndex++;
          results[currentIndex] = await worker(items[currentIndex], currentIndex);
        }
      }
    );

    await Promise.all(workers);
    return results;
  }

  async uploadToS3(req: Request, res: Response) {
    // [LOG] Confirming which API is hit
    logger.info("=================================================", {
      console: true,
    });
    logger.info(">>> API HIT: uploadToS3 (ORIGINALS UPLOAD) <<<", {
      console: true,
    });
    logger.info("=================================================", {
      console: true,
    });

    try {
      const userProvidedDir = req.body.localDir;
      const defaultOutputRoot = path.join(process.cwd(), "output");

      const targetRoot =
        userProvidedDir && userProvidedDir.trim() !== ""
          ? userProvidedDir
          : defaultOutputRoot;

      // SAFETY GUARD: Prevent accidental upload of split_output via this handler
      if (targetRoot.includes("split_output")) {
        logger.warn(
          `Blocked attempt to upload 'split_output' via 'uploadToS3' (Originals) handler.`,
          { console: true }
        );
        return res.status(400).json({
          statusCode: 400,
          error: "Invalid Directory",
          details:
            "You are trying to upload the 'split_output' folder using the 'Upload Original' button. Please use the 'Upload Split Files' button instead.",
        });
      }

      logger.info({
        category: "task-steps",
        function: "uploadToS3",
        message: `Initiating Originals Upload. Target: ${targetRoot}`,
        console: true,
      });

      try {
        await fs.access(targetRoot);
      } catch (e) {
        throw new Error(`Directory not found: ${targetRoot}`);
      }

      const bucket = S3_BUCKET_NAME;
      const items = await fs.readdir(targetRoot, { withFileTypes: true });

      const clientDirs = items.filter(
        (d) => d.isDirectory() && d.name.startsWith("CLIENT_CODE_")
      );

      if (clientDirs.length === 0) {
        logger.warn(`No 'CLIENT_CODE_' directories found in ${targetRoot}.`, {
          console: true,
        });
        return res.status(200).json({
          statusCode: 200,
          message:
            "No client directories (starting with CLIENT_CODE_) found in the target folder.",
          successfulFilesCount: 0,
          failedFilesCount: 0,
        });
      }

      const folderConcurrency = this.getBoundedNumber(
        req.body.folderConcurrency ?? process.env.S3_FOLDER_CONCURRENCY,
        4,
        1,
        8
      );
      const fileBatchSize = this.getBoundedNumber(
        req.body.fileBatchSize ?? process.env.S3_FILE_BATCH_SIZE,
        15,
        1,
        50
      );
      const jobId = this.createUploadJobId("ORIGINALS");
      let completedFolders = 0;
      let aggregateSuccessfulFiles = 0;
      let aggregateFailedFiles = 0;

      this.emitS3Progress({
        type: "s3-upload-start",
        jobId,
        uploadKind: "Originals",
        totalFolders: clientDirs.length,
        folderConcurrency,
        fileBatchSize,
      });

      const uploadResults = await this.runWithConcurrency(
        clientDirs,
        folderConcurrency,
        async (clientDir, index): Promise<S3UploadResult> => {
          const clientPath = path.join(targetRoot, clientDir.name);
          const s3Prefix = getS3FilePrefix(clientDir.name);
          const folderId = `${jobId}:${clientDir.name}`;

          logger.info({
            category: "task-steps",
            function: "uploadToS3",
            message: `[Folder ${index + 1}/${clientDirs.length}] Processing Original: ${clientDir.name} -> s3://${bucket}/${s3Prefix}`,
            console: true,
          });

          this.emitS3Progress({
            type: "s3-folder-start",
            jobId,
            folderId,
            folderName: clientDir.name,
            s3Prefix,
            uploadKind: "Originals",
            folderIndex: index + 1,
            totalFolders: clientDirs.length,
          });

          try {
            const result = await uploadDirectoryRecursive(
              clientPath,
              bucket,
              s3Prefix,
              "ORIGINALS",
              {
                jobId,
                folderId,
                folderName: clientDir.name,
                emitLegacyProgress: false,
                fileBatchSize,
              }
            );

            completedFolders++;
            aggregateSuccessfulFiles += result.successfulFilesCount;
            aggregateFailedFiles += result.failedFilesCount;

            this.emitS3Progress({
              type: "s3-folder-complete",
              jobId,
              folderId,
              folderName: clientDir.name,
              uploadKind: "Originals",
              status:
                result.failedFilesCount > 0
                  ? "completed_with_errors"
                  : "completed",
              completedFolders,
              totalFolders: clientDirs.length,
              successfulFilesCount: result.successfulFilesCount,
              failedFilesCount: result.failedFilesCount,
              aggregateSuccessfulFiles,
              aggregateFailedFiles,
            });

            return result;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            logger.error({
              category: "task-steps",
              function: "uploadToS3",
              message: `S3 upload error for ${clientDir.name}`,
              error: errorMessage,
            });

            completedFolders++;
            aggregateFailedFiles++;

            this.emitS3Progress({
              type: "s3-folder-complete",
              jobId,
              folderId,
              folderName: clientDir.name,
              uploadKind: "Originals",
              status: "failed",
              completedFolders,
              totalFolders: clientDirs.length,
              successfulFilesCount: 0,
              failedFilesCount: 1,
              aggregateSuccessfulFiles,
              aggregateFailedFiles,
              errorMessage,
            });

            return {
              successfulFilesCount: 0,
              failedFilesCount: 1,
              failedFileDetails: [
                {
                  name: clientDir.name,
                  error: errorMessage,
                },
              ],
            };
          }
        }
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

      this.emitS3Progress({
        type: "s3-upload-complete",
        jobId,
        uploadKind: "Originals",
        totalFolders: clientDirs.length,
        completedFolders: clientDirs.length,
        successfulFilesCount: totalSuccessfulFiles,
        failedFilesCount: totalFailedFiles,
        status: totalFailedFiles > 0 ? "completed_with_errors" : "completed",
      });

      res.status(200).json({
        statusCode: 200,
        message: message,
        successfulFilesCount: totalSuccessfulFiles,
        failedFilesCount: totalFailedFiles,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error &&
        error.message &&
        error.message.includes("expired credentials")
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
        console: true,
      });

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
    logger.info("=================================================", {
      console: true,
    });
    logger.info(">>> API HIT: uploadSplitFilesToS3 (SPLITS UPLOAD) <<<", {
      console: true,
    });
    logger.info("=================================================", {
      console: true,
    });

    const defaultSplitRoot = path.join(process.cwd(), "split_output");
    const userProvidedDir = req.body.localDir;

    const splitOutputRoot =
      userProvidedDir && userProvidedDir.trim() !== ""
        ? userProvidedDir
        : defaultSplitRoot;

    logger.info({
      category: "task-steps",
      function: "uploadSplitFilesToS3",
      message: `Initiating Split Files Upload. Target: ${splitOutputRoot}`,
      console: true,
    });

    const bucket = S3_BUCKET_NAME;

    try {
      try {
        await fs.access(splitOutputRoot);
      } catch (e) {
        throw new Error(`Split output directory not found: ${splitOutputRoot}`);
      }

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

      const folderConcurrency = this.getBoundedNumber(
        req.body.folderConcurrency ?? process.env.S3_FOLDER_CONCURRENCY,
        4,
        1,
        8
      );
      const fileBatchSize = this.getBoundedNumber(
        req.body.fileBatchSize ?? process.env.S3_FILE_BATCH_SIZE,
        15,
        1,
        50
      );
      const jobId = this.createUploadJobId("SPLITS");
      let completedFolders = 0;
      let aggregateSuccessfulFiles = 0;
      let aggregateFailedFiles = 0;

      this.emitS3Progress({
        type: "s3-upload-start",
        jobId,
        uploadKind: "Splits",
        totalFolders: clientDirs.length,
        folderConcurrency,
        fileBatchSize,
      });

      const uploadResults = await this.runWithConcurrency(
        clientDirs,
        folderConcurrency,
        async (clientDir, index): Promise<S3UploadResult> => {
          const clientPath = path.join(splitOutputRoot, clientDir.name);
          const s3Prefix = getS3SplitPrefix(clientDir.name);
          const folderId = `${jobId}:${clientDir.name}`;

          logger.info({
            category: "task-steps",
            function: "uploadSplitFilesToS3",
            message: `[Folder ${index + 1}/${clientDirs.length}] Processing Splits: ${clientDir.name} -> s3://${bucket}/${s3Prefix}`,
            console: true,
          });

          this.emitS3Progress({
            type: "s3-folder-start",
            jobId,
            folderId,
            folderName: clientDir.name,
            s3Prefix,
            uploadKind: "Splits",
            folderIndex: index + 1,
            totalFolders: clientDirs.length,
          });

          try {
            const result = await uploadDirectoryRecursive(
              clientPath,
              bucket,
              s3Prefix,
              "SPLITS",
              {
                jobId,
                folderId,
                folderName: clientDir.name,
                emitLegacyProgress: false,
                fileBatchSize,
              }
            );

            completedFolders++;
            aggregateSuccessfulFiles += result.successfulFilesCount;
            aggregateFailedFiles += result.failedFilesCount;

            this.emitS3Progress({
              type: "s3-folder-complete",
              jobId,
              folderId,
              folderName: clientDir.name,
              uploadKind: "Splits",
              status:
                result.failedFilesCount > 0
                  ? "completed_with_errors"
                  : "completed",
              completedFolders,
              totalFolders: clientDirs.length,
              successfulFilesCount: result.successfulFilesCount,
              failedFilesCount: result.failedFilesCount,
              aggregateSuccessfulFiles,
              aggregateFailedFiles,
            });

            return result;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            logger.error({
              category: "task-steps",
              function: "uploadSplitFilesToS3",
              message: `S3 upload error for ${clientDir.name}`,
              error: errorMessage,
            });

            completedFolders++;
            aggregateFailedFiles++;

            this.emitS3Progress({
              type: "s3-folder-complete",
              jobId,
              folderId,
              folderName: clientDir.name,
              uploadKind: "Splits",
              status: "failed",
              completedFolders,
              totalFolders: clientDirs.length,
              successfulFilesCount: 0,
              failedFilesCount: 1,
              aggregateSuccessfulFiles,
              aggregateFailedFiles,
              errorMessage,
            });

            return {
              successfulFilesCount: 0,
              failedFilesCount: 1,
              failedFileDetails: [
                {
                  name: clientDir.name,
                  error: errorMessage,
                },
              ],
            };
          }
        }
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

      this.emitS3Progress({
        type: "s3-upload-complete",
        jobId,
        uploadKind: "Splits",
        totalFolders: clientDirs.length,
        completedFolders: clientDirs.length,
        successfulFilesCount: totalSuccessfulFiles,
        failedFilesCount: totalFailedFiles,
        status: totalFailedFiles > 0 ? "completed_with_errors" : "completed",
      });

      res.status(200).json({
        statusCode: 200,
        message: message,
        successfulFilesCount: totalSuccessfulFiles,
        failedFilesCount: totalFailedFiles,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error &&
        error.message &&
        error.message.includes("expired credentials")
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
        console: true,
      });
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
      // [FIX] Read MaxKeys from query param (default to 1000 if not sent)
      const maxKeys = req.query.maxKeys
        ? parseInt(req.query.maxKeys as string)
        : undefined;

      logger.info({
        category: "api-calls",
        function: "listS3Files",
        message: `Initiating S3 file listing for prefix: ${prefix}, maxKeys: ${maxKeys}`,
      });

      // [FIX] Pass maxKeys to the manager
      const data = await listFiles(prefix, continuationToken, maxKeys);
      res.status(200).json({ statusCode: 200, ...data });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message && error.message.includes("expired credentials")
          : error
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
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message && error.message.includes("expired credentials")
          : error
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
      const filenamePattern = (req.query.filenamePattern as string) || ".*";

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

      if (!isTransactionPatternProvided && !isFilenamePatternProvided) {
        const listResult = await listFiles(
          currentBrowsingPrefix,
          continuationToken
        );
        directories = listResult.directories;
        files = listResult.files;
        nextContinuationToken = listResult.nextContinuationToken;
      } else if (isTransactionPatternProvided && !isFilenamePatternProvided) {
        let allDirectories: string[] = [];
        let currentContinuationToken: string | undefined = continuationToken;

        do {
          const listResult = await listFiles(
            currentBrowsingPrefix,
            currentContinuationToken
          );
          allDirectories = allDirectories.concat(listResult.directories);
          currentContinuationToken = listResult.nextContinuationToken;
        } while (currentContinuationToken);

        const transactionRegex = new RegExp(
          `^${currentBrowsingPrefix}CLIENT_CODE_\\d+_TRANSACTION_NUMBER_${transactionNumberPattern}`
        );
        directories = allDirectories.filter((dir) =>
          transactionRegex.test(dir)
        );
        files = [];
        nextContinuationToken = undefined;
      } else if (!isTransactionPatternProvided && isFilenamePatternProvided) {
        const s3CommandPrefix = "";
        const fileSearchRegex = `^${currentBrowsingPrefix}.*CLIENT_CODE_\\d+_TRANSACTION_NUMBER_\\d+/${filenamePattern}`;
        const allMatchedFiles = await searchFiles(
          s3CommandPrefix,
          fileSearchRegex
        );
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
        files = [];
        nextContinuationToken = undefined;
      } else {
        const s3CommandPrefix = "";
        const clientCodeMatch =
          currentBrowsingPrefix.match(/CLIENT_CODE_(\d+)/);
        const clientCode = clientCodeMatch ? clientCodeMatch[1] : "d+";

        const transactionPart = `CLIENT_CODE_${clientCode}_TRANSACTION_NUMBER_${transactionNumberPattern}`;
        const fileSearchRegex = `^${currentBrowsingPrefix}${transactionPart}/${filenamePattern}`;

        const allMatchedFiles = await searchFiles(
          s3CommandPrefix,
          fileSearchRegex
        );
        files = allMatchedFiles.files;
        directories = [];
        nextContinuationToken = undefined;
      }

      res
        .status(200)
        .json({ statusCode: 200, files, directories, nextContinuationToken });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message && error.message.includes("expired credentials")
          : error
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
      res.status(200).json({ statusCode: 200, ...data });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message && error.message.includes("expired credentials")
          : error
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
}

export const s3ProcessorController = new S3ProcessorController();
