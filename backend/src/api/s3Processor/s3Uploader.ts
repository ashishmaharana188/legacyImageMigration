import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs";
import path from "path";
import https from "https";
import { broadcast } from "../../utils/webSocketService";
import { S3_BUCKET_NAME } from "../../utils/s3Config";
import { isAuthError, countTrackedDirectories } from "./s3ProcessorUtil";
import { createFeatureLogger } from "../../utils/logger";

const logger = createFeatureLogger("s3Processor");

const agent = new https.Agent({
  maxSockets: 200,
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
}

export async function uploadOriginalToS3(
  localFilePath: string,
  s3Key: string
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
      { console: true }
    );
    return `Successfully uploaded ${localFilePath} to ${S3_BUCKET_NAME}/${s3Key}`;
  } catch (err: unknown) {
    if (isAuthError(err)) {
      const msg =
        "S3 uploadOriginalToS3 failed: Authentication token expired or invalid.";
      logger.error(msg, { console: true });
      throw new Error(
        "S3 operation failed due to expired or invalid credentials."
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
  s3Prefix: string
): Promise<string[]> {
  logger.info(
    `Starting Batch Upload of ${localFilePaths.length} split files...`,
    { console: true }
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
          "S3 operation failed due to expired or invalid credentials."
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
  key: string
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
        "S3 upload failed due to expired or invalid credentials."
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
  options?: UploadOptions
) {
  if (!localDir || localDir.trim() === "") {
    throw new Error("Local directory path is empty or undefined.");
  }

  logger.info(`[${context}] S3 Upload Running... Target: ${localDir}`, {
    console: true,
  });

  let totalDirectories = 0;
  const directoryQueue: {
    localPath: string;
    s3Prefix: string;
    isClientCodeParent: boolean;
  }[] = [];

  const initialDirName = path.basename(localDir);
  const isInitialDirClientCode = /^CLIENT_CODE_\d+$/.test(initialDirName);

  if (!isInitialDirClientCode) {
    totalDirectories = countTrackedDirectories(localDir, false);
    directoryQueue.push({
      localPath: localDir,
      s3Prefix: prefix,
      isClientCodeParent: false,
    });
  } else {
    const entries = fs.readdirSync(localDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const entryPath = path.join(localDir, entry.name);
        const entryKey = `${prefix}/${entry.name}`;
        totalDirectories += countTrackedDirectories(entryPath, true);
        directoryQueue.push({
          localPath: entryPath,
          s3Prefix: entryKey,
          isClientCodeParent: true,
        });
      }
    }
  }

  if (totalDirectories === 0) {
    broadcast(
      JSON.stringify({
        type: "complete",
        fileName: prefix,
        status: "Done",
        isDirectory: true,
        totalDirectories: 0,
        successfulFilesCount: 0,
        failedFilesCount: 0,
      })
    );
    logger.warn(`[${context}] No directories found to upload.`, {
      console: true,
    });
    return {
      successfulFilesCount: 0,
      failedFilesCount: 0,
      failedFileDetails: [],
    };
  }

  broadcast(
    JSON.stringify({
      type: "s3-upload-total-directories",
      totalDirectories: totalDirectories,
    })
  );

  let completedDirectories = 0;
  let successfulFilesCount = 0;
  let failedFilesCount = 0;
  const results = {
    successfulFilesCount: 0,
    failedFilesCount: 0,
    failedFileDetails: [] as { name: string; error: string }[],
  };

  while (directoryQueue.length > 0) {
    const { localPath, s3Prefix, isClientCodeParent } = directoryQueue.shift()!;
    const currentDirName = path.basename(localPath);
    const isCurrentDirClientCode = /^CLIENT_CODE_\d+$/.test(currentDirName);

    // Log Deduplication Set for this directory
    const loggedBaseFiles = new Set<string>();

    try {
      const entries = fs.readdirSync(localPath, { withFileTypes: true });
      const batchSize = 50;

      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const uploadPromises: Promise<void>[] = [];

        for (const entry of batch) {
          const entryPath = path.join(localPath, entry.name);
          const entryKey = `${s3Prefix}/${entry.name}`;

          if (
            options?.excludePattern &&
            options.excludePattern.test(entry.name)
          ) {
            continue;
          }

          if (entry.isDirectory()) {
            directoryQueue.push({
              localPath: entryPath,
              s3Prefix: entryKey,
              isClientCodeParent: isClientCodeParent || isCurrentDirClientCode,
            });
          } else {
            const fileUploadPromise = (async () => {
              try {
                await uploadFile(entryPath, bucket, entryKey);
                successfulFilesCount++;

                if (context === "SPLITS") {
                  const baseName = entry.name.replace(/_\d+\.pdf$/, ".pdf");
                  if (!loggedBaseFiles.has(baseName)) {
                    loggedBaseFiles.add(baseName);
                    logger.info(`[${context}] Uploaded: ${baseName}`, {
                      console: false,
                    });
                  }
                } else {
                  logger.info(`[${context}] Uploaded: ${entry.name}`, {
                    console: false,
                  });
                }
              } catch (uploadError: unknown) {
                failedFilesCount++;
                const errMsg =
                  uploadError instanceof Error
                    ? uploadError.message
                    : "Unknown upload error";
                logger.error(`[${context}] Failed: ${entry.name} - ${errMsg}`, {
                  console: true,
                });
                results.failedFileDetails.push({
                  name: entry.name,
                  error: errMsg,
                });
              }
            })();
            uploadPromises.push(fileUploadPromise);
          }
        }
        await Promise.all(uploadPromises);

        if (i + batchSize >= entries.length) {
          if (isClientCodeParent || !isCurrentDirClientCode) {
            completedDirectories++;
            // [FIX] Broadcasting REAL-TIME file stats
            broadcast(
              JSON.stringify({
                type: "s3-directory-progress",
                completedDirectories: completedDirectories,
                totalDirectories: totalDirectories,
                currentDirectory: s3Prefix,
                successfulFilesCount: successfulFilesCount, // [ADDED]
                failedFilesCount: failedFilesCount, // [ADDED]
              })
            );
          }
        }
      }
    } catch (err: unknown) {
      if (isAuthError(err)) {
        throw new Error("S3 operation failed due to expired credentials.");
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[${context}] Directory Error ${localPath}: ${msg}`, {
          console: true,
        });
        failedFilesCount++;
      }
    }
  }

  results.successfulFilesCount = successfulFilesCount;
  results.failedFilesCount = failedFilesCount;

  logger.info(
    `[${context}] S3 Upload Success. Uploaded: ${successfulFilesCount}, Failed: ${failedFilesCount}`,
    { console: true }
  );

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
    })
  );

  return results;
}

export async function uploadDirectoryRecursive(
  localDir: string,
  bucket: string,
  prefix: string,
  context: string,
  options?: UploadOptions
) {
  return performIterativeUpload(localDir, bucket, prefix, context, options);
}
