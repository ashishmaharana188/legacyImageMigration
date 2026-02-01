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

class S3ProcessorController {
  async uploadToS3(req: Request, res: Response) {
    // [LOG] Confirming which API is hit
    logger.info("", {
      console: true,
    });
    logger.info("API: uploadToS3 (ORIGINALS UPLOAD)", {
      console: true,
    });
    logger.info("", {
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

      const uploadResults = await Promise.all(
        clientDirs.map(async (clientDir) => {
          const clientPath = path.join(targetRoot, clientDir.name);
          const s3Prefix = getS3FilePrefix(clientDir.name);

          logger.info({
            category: "task-steps",
            function: "uploadToS3",
            message: `Uploading Original Folder: ${clientDir.name} → s3://${bucket}/${s3Prefix}`,
            console: true,
          });

          try {
            // [REVERTED] No options/filters passed here anymore. Just pure upload.
            return await uploadDirectoryRecursive(
              clientPath,
              bucket,
              s3Prefix,
              "ORIGINALS"
            );
          } catch (error) {
            logger.error({
              category: "task-steps",
              function: "uploadToS3",
              message: `S3 upload error for ${clientDir.name}`,
              error: error instanceof Error ? error.message : "Unknown error",
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
    logger.info("", {
      console: true,
    });
    logger.info("API HIT: uploadSplitFilesToS3 (SPLITS UPLOAD)", {
      console: true,
    });
    logger.info("", {
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

      const uploadResults = await Promise.all(
        clientDirs.map(async (clientDir) => {
          const clientPath = path.join(splitOutputRoot, clientDir.name);
          const s3Prefix = getS3SplitPrefix(clientDir.name);

          logger.info({
            category: "task-steps",
            function: "uploadSplitFilesToS3",
            message: `Uploading SplitFiles for ${clientDir.name} → s3://${bucket}/${s3Prefix}`,
            console: true,
          });

          try {
            return await uploadDirectoryRecursive(
              clientPath,
              bucket,
              s3Prefix,
              "SPLITS"
            );
          } catch (error) {
            logger.error({
              category: "task-steps",
              function: "uploadSplitFilesToS3",
              message: `S3 upload error for ${clientDir.name}`,
              error: error instanceof Error ? error.message : "Unknown error",
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

  // ... (Other methods listS3Files, etc. remain unchanged)
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
