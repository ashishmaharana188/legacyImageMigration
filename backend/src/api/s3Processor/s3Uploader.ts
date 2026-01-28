import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs";
import path from "path";
import https from "https";
import { broadcast } from "../../utils/webSocketService";
import { S3_BUCKET_NAME } from "../../utils/s3Config";
import { isAuthError, countTrackedDirectories } from "./s3ProcessorUtil";

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

export async function uploadOriginalToS3(
  localFilePath: string,
  s3Key: string
): Promise<string> {
  const fileStream = fs.createReadStream(localFilePath);
  const uploadParams = {
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
    Body: fileStream,
  };

  try {
    await s3.send(new PutObjectCommand(uploadParams));
    console.log(`Successfully uploaded ${path.basename(localFilePath)} to S3.`);
    return `Successfully uploaded ${localFilePath} to ${S3_BUCKET_NAME}/${s3Key}`;
  } catch (err: unknown) {
    if (isAuthError(err)) {
      console.error(
        "S3 uploadOriginalToS3 failed: Authentication token expired or invalid."
      );
      throw new Error(
        "S3 operation failed due to expired or invalid credentials."
      );
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error uploading original file to S3: ${msg}`);
      throw new Error(msg);
    }
  }
}

export async function uploadSplitFilesToS3(
  localFilePaths: string[],
  s3Prefix: string
): Promise<string[]> {
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
      console.log(`Successfully uploaded ${fileName} to S3.`);
    } catch (err: unknown) {
      if (isAuthError(err)) {
        console.error(
          "S3 uploadSplitFilesToS3 failed: Authentication token expired."
        );
        throw new Error(
          "S3 operation failed due to expired or invalid credentials."
        );
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error uploading split file ${fileName}: ${msg}`);
        throw new Error(msg);
      }
    }
  }
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
      console.error(
        `S3 uploadFile failed for ${key}: Authentication token expired.`
      );
      throw new Error(
        "S3 upload failed due to expired or invalid credentials."
      );
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`S3 uploadFile error for ${key}: ${msg}`);
      throw new Error(msg);
    }
  }
}

async function performIterativeUpload(
  localDir: string,
  bucket: string,
  prefix: string
) {
  if (!localDir || localDir.trim() === "") {
    throw new Error("Local directory path is empty or undefined.");
  }
  console.log(`S3 upload process initiated for ${localDir}.`);
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
      })
    );
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

    try {
      const entries = fs.readdirSync(localPath, { withFileTypes: true });
      const batchSize = 50;

      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const uploadPromises: Promise<void>[] = [];

        for (const entry of batch) {
          const entryPath = path.join(localPath, entry.name);
          const entryKey = `${s3Prefix}/${entry.name}`;

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
              } catch (uploadError: unknown) {
                failedFilesCount++;
                results.failedFileDetails.push({
                  name: entry.name,
                  error:
                    uploadError instanceof Error
                      ? uploadError.message
                      : "Unknown upload error",
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
            broadcast(
              JSON.stringify({
                type: "s3-directory-progress",
                completedDirectories: completedDirectories,
                totalDirectories: totalDirectories,
                currentDirectory: s3Prefix,
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
        console.error(`S3 upload error for ${localPath}: ${msg}`);
        failedFilesCount++;
      }
    }
  }

  results.successfulFilesCount = successfulFilesCount;
  results.failedFilesCount = failedFilesCount;

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
  prefix: string
) {
  return performIterativeUpload(localDir, bucket, prefix);
}
