import { Request, Response } from "express";
import fs from "fs/promises";
import logger from "../../utils/logger"
import { uploadDirectoryRecursive, uploadSplitFilesToS3, uploadOriginalToS3 } from "./s3Uploader";
import { listFiles,deleteFiles,searchFiles, searchFolders } from "./s3Manager";
import path from "path";
import {
  S3_BUCKET_NAME,
  getS3FilePrefix,
  getS3SplitPrefix,
} from "../../utils/s3Config";


class S3ProcessorController {

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
        } catch (error: unknown) {
            const errorMessage =
              error instanceof Error ?  error.message && error.message.includes("expired credentials"):error
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
            const clients = await fs.readdir(splitOutputRoot, { withFileTypes: true });
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

                    const filesInClientDir = await fs.readdir(clientPath, { withFileTypes: true });
                    const localFilePaths = filesInClientDir
                        .filter(file => file.isFile())
                        .map(file => path.join(clientPath, file.name));

                    logger.info({
                        category: "task-steps",
                        function: "uploadSplitFilesToS3",
                        message: `Uploading SplitFiles for ${clientDir.name} → s3://${bucket}/${s3Prefix}`,
                    });
                    try {
                        const uploadedKeys = await uploadSplitFilesToS3(localFilePaths, s3Prefix);
                        return {
                            successfulFilesCount: uploadedKeys.length,
                            failedFilesCount: localFilePaths.length - uploadedKeys.length,
                            failedFileDetails: [], // Detailed errors would be logged inside uploadSplitFilesToS3
                        };
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
                            failedFilesCount: localFilePaths.length,
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
              error instanceof Error ?  error.message && error.message.includes("expired credentials"):error
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
            if (!res.headersSent) {
                res.status(500).json({
                    statusCode: 500,
                    error: "A critical error occurred during the S3 upload process.",
                    details: errorMessage,
                });
            }
        }
    }
    async uploadOriginalToS3(req: Request, res: Response) {
        try {
            const { localFilePath, s3Key } = req.body;

            if (!localFilePath || !s3Key) {
                return res.status(400).json({
                    statusCode: 400,
                    error: "Missing required parameters: localFilePath and s3Key.",
                });
            }

            logger.info({
                category: "api-calls",
                function: "uploadOriginalToS3",
                message: `Initiating S3 upload for original file: ${localFilePath} to ${s3Key}`,
            });

            const result = await uploadOriginalToS3(localFilePath, s3Key);

            res.status(200).json({
                statusCode: 200,
                message: "Original file uploaded successfully",
                result,
            });
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error ? error.message && error.message.includes("expired credentials") : error
                    ? "S3 operation failed: Authentication token expired. Please refresh your credentials."
                    : error instanceof Error
                        ? error.message
                        : "Unknown error";
            logger.error({
                category: "api-calls",
                function: "uploadOriginalToS3",
                message: "Failed to upload original file to S3",
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
            });
            res.status(500).json({
                statusCode: 500,
                error: "Failed to upload original file to S3",
                details: errorMessage,
            });
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
            res.status(200).json({ statusCode: 200, ...data });
        } catch (error: unknown) {
            const errorMessage =
              error instanceof Error ?  error.message && error.message.includes("expired credentials"):error
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
               error instanceof Error ? error.message && error.message.includes("expired credentials"):error
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
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error ? error.message && error.message.includes("expired credentials") :error
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
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error ? error.message && error.message.includes("expired credentials") : error
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
