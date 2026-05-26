import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs";
import path from "path";
import https from "https";
import { broadcast } from "../../utils/webSocketService";
import { S3_BUCKET_NAME } from "../../utils/s3Config";
import { isAuthError } from "./s3ProcessorUtil";
import { createFeatureLogger } from "../../utils/logger";

const logger = createFeatureLogger("s3Processor");

const agent = new https.Agent({
  maxSockets: 200,
  rejectUnauthorized: false,

});

const s3 = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    sessionToken: process.env.AWS_SESSION_TOKEN as string | undefined,
  },
  requestHandler: new NodeHttpHandler({
    httpsAgent: agent,
  }),
});

export interface UploadOptions {
  excludePattern?: RegExp;
  jobId?: string;
  folderId?: string;
  folderName?: string;
  emitLegacyProgress?: boolean;
  fileBatchSize?: number;
}

export async function uploadOriginalToS3(
  localFilePath: string,
  s3Key: string,
): Promise<string> {
  logger.info(`Starting Single File Upload: ${path.basename(localFilePath)}`, {
    console: true,
  });

  const fileStream = fs.createReadStream(localFilePath);
  const uploadParams = {
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
    Body: fileStream,
  };

  try {
    await s3.send(new PutObjectCommand(uploadParams));
    logger.info(
      `Successfully uploaded ${path.basename(localFilePath)} to S3.`,
      { console: true },
    );
    return `Successfully uploaded ${localFilePath} to ${S3_BUCKET_NAME}/${s3Key}`;
  } catch (err: unknown) {
    if (isAuthError(err)) {
      const msg =
        "S3 uploadOriginalToS3 failed: Authentication token expired or invalid.";
      logger.error(msg, { console: true });
      throw new Error(
        "S3 operation failed due to expired or invalid credentials.",
      );
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Error uploading original file to S3: ${msg}`, {
        console: true,
      });
      throw new Error(msg);
    }
  }
}

export async function uploadSplitFilesToS3(
  localFilePaths: string[],
  s3Prefix: string,
): Promise<string[]> {
  logger.info(
    `Starting Batch Upload of ${localFilePaths.length} split files...`,
    { console: true },
  );

  const uploadedKeys: string[] = [];
  for (const localFilePath of localFilePaths) {
    const fileName = path.basename(localFilePath);
    const s3Key = `${s3Prefix}${fileName}`;
    const fileStream = fs.createReadStream(localFilePath);

    const uploadParams = {
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
      Body: fileStream,
    };

    try {
      await s3.send(new PutObjectCommand(uploadParams));
      uploadedKeys.push(s3Key);
      logger.info(`Uploaded: ${fileName}`, { console: false });
    } catch (err: unknown) {
      if (isAuthError(err)) {
        logger.error("S3 uploadSplitFilesToS3 failed: Auth token expired.", {
          console: true,
        });
        throw new Error(
          "S3 operation failed due to expired or invalid credentials.",
        );
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Error uploading split file ${fileName}: ${msg}`, {
          console: true,
        });
        throw new Error(msg);
      }
    }
  }

  logger.info(`Batch Upload Complete. ${uploadedKeys.length} files uploaded.`, {
    console: true,
  });
  return uploadedKeys;
}

export async function uploadFile(
  localFilePath: string,
  bucket: string,
  key: string,
) {
  try {
    const fileStream = fs.createReadStream(localFilePath);
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: bucket,
        Key: key,
        Body: fileStream,
      },
    });
    await upload.done();
  } catch (err: unknown) {
    if (isAuthError(err)) {
      throw new Error(
        "S3 upload failed due to expired or invalid credentials.",
      );
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(msg);
    }
  }
}

async function performIterativeUpload(
  localDir: string,
  bucket: string,
  prefix: string,
  context: string,
  options?: UploadOptions,
) {
  if (!localDir || localDir.trim() === "") {
    throw new Error("Local directory path is empty or undefined.");
  }

  logger.info(`[${context}] S3 Upload Running... Target: ${localDir}`, {
    console: true,
  });

  // 1. Instantly read only the top level (No deep traversal lag)
  const topLevelEntries = await fs.promises.readdir(localDir, {
    withFileTypes: true,
  });
  const subDirs = topLevelEntries.filter((e) => e.isDirectory());
  const rootFiles = topLevelEntries.filter((e) => !e.isDirectory());

  const totalDirectories = subDirs.length > 0 ? subDirs.length : 1;

  broadcast(
    JSON.stringify({
      type: "s3-upload-total-directories",
      totalDirectories: totalDirectories,
    }),
  );

  let completedDirectories = 0;
  let successfulFilesCount = 0;
  let failedFilesCount = 0;
  const results = {
    successfulFilesCount: 0,
    failedFilesCount: 0,
    failedFileDetails: [] as { name: string; error: string }[],
  };

  const BATCH_SIZE = options?.fileBatchSize || 15;
  const emitLegacyProgress = options?.emitLegacyProgress !== false;

  function emitFolderProgress(currentDirectory: string) {
    if (!options?.jobId || !options.folderId) return;

    broadcast(
      JSON.stringify({
        type: "s3-folder-progress",
        jobId: options.jobId,
        folderId: options.folderId,
        folderName: options.folderName || path.basename(localDir),
        currentDirectory,
        completedDirectories,
        totalDirectories,
        successfulFilesCount,
        failedFilesCount,
        processedFiles: successfulFilesCount + failedFilesCount,
      }),
    );
  }

  // Async helper to process files in controlled batches
  async function processFilesBatch(
    files: fs.Dirent[],
    currentLocalPath: string,
    currentS3Prefix: string,
    loggedBaseFiles: Set<string>,
  ) {
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const uploadPromises = batch.map(async (file) => {
        if (options?.excludePattern && options.excludePattern.test(file.name)) {
          return;
        }

        const entryPath = path.join(currentLocalPath, file.name);
        const entryKey = `${currentS3Prefix}/${file.name}`;

        try {
          await uploadFile(entryPath, bucket, entryKey);
          successfulFilesCount++;

          if (context === "SPLITS") {
            const baseName = file.name.replace(/_\d+\.pdf$/, ".pdf");
            if (!loggedBaseFiles.has(baseName)) {
              loggedBaseFiles.add(baseName);
              logger.info(`[${context}] Uploaded: ${baseName}`, {
                console: false,
              });
            }
          } else {
            logger.info(`[${context}] Uploaded: ${file.name}`, {
              console: false,
            });
          }
        } catch (uploadError: unknown) {
          failedFilesCount++;
          const errMsg =
            uploadError instanceof Error
              ? uploadError.message
              : "Unknown upload error";
          logger.error(`[${context}] Failed: ${file.name} - ${errMsg}`, {
            console: true,
          });
          results.failedFileDetails.push({ name: file.name, error: errMsg });
        }
      });

      await Promise.all(uploadPromises);
      emitFolderProgress(currentS3Prefix);
    }
  }

  // Recursive DFS helper for deep folders (waits to finish before returning)
  async function uploadFolderContents(
    currentLocalPath: string,
    currentS3Prefix: string,
    loggedBaseFiles: Set<string>,
  ) {
    try {
      const entries = await fs.promises.readdir(currentLocalPath, {
        withFileTypes: true,
      });

      const files = entries.filter((e) => !e.isDirectory());
      const dirs = entries.filter((e) => e.isDirectory());

      await processFilesBatch(
        files,
        currentLocalPath,
        currentS3Prefix,
        loggedBaseFiles,
      );

      for (const dir of dirs) {
        await uploadFolderContents(
          path.join(currentLocalPath, dir.name),
          `${currentS3Prefix}/${dir.name}`,
          loggedBaseFiles,
        );
      }
    } catch (err: unknown) {
      if (isAuthError(err)) {
        throw new Error("S3 operation failed due to expired credentials.");
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(
          `[${context}] Directory Error ${currentLocalPath}: ${msg}`,
          { console: true },
        );
        failedFilesCount++;
      }
    }
  }

  // 2. Execution Start
  const globalLoggedBaseFiles = new Set<string>();

  // Process stray files in the root directly
  if (rootFiles.length > 0) {
    await processFilesBatch(rootFiles, localDir, prefix, globalLoggedBaseFiles);
    if (subDirs.length === 0) {
      completedDirectories = 1;
    }
    emitFolderProgress(prefix);
  }

  // Process subdirectories sequentially to track parent completion exactly
  for (const dir of subDirs) {
    const parentLoggedBaseFiles = new Set<string>();

    await uploadFolderContents(
      path.join(localDir, dir.name),
      `${prefix}/${dir.name}`,
      parentLoggedBaseFiles,
    );

    completedDirectories++;

    emitFolderProgress(`${prefix}/${dir.name}`);

    if (emitLegacyProgress) {
      broadcast(
        JSON.stringify({
          type: "s3-directory-progress",
          completedDirectories: completedDirectories,
          totalDirectories: totalDirectories,
          currentDirectory: `${prefix}/${dir.name}`,
          successfulFilesCount: successfulFilesCount,
          failedFilesCount: failedFilesCount,
        }),
      );
    }
  }

  results.successfulFilesCount = successfulFilesCount;
  results.failedFilesCount = failedFilesCount;

  logger.info(
    `[${context}] S3 Upload Success. Uploaded: ${successfulFilesCount}, Failed: ${failedFilesCount}`,
    { console: true },
  );

  if (emitLegacyProgress) {
    broadcast(
      JSON.stringify({
        type: "complete",
        fileName: prefix,
        status: "Done",
        isDirectory: true,
        totalDirectories: totalDirectories,
        completedDirectories: completedDirectories,
        successfulFilesCount: successfulFilesCount,
        failedFilesCount: failedFilesCount,
      }),
    );
  }

  return results;
}

export async function uploadDirectoryRecursive(
  localDir: string,
  bucket: string,
  prefix: string,
  context: string,
  options?: UploadOptions,
) {
  return performIterativeUpload(localDir, bucket, prefix, context, options);
}
