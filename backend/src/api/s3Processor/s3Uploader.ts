import { S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs";
import path from "path";
import https from "https";
import { broadcast } from "../../utils/webSocketService";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { S3_BUCKET_NAME } from "../../utils/s3Config";

export async function uploadOriginalToS3(localFilePath: string, s3Key: string): Promise<string> {
  const fileStream = fs.createReadStream(localFilePath);

  const uploadParams = {
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
    Body: fileStream,
  };

  try {
    await s3.send(new PutObjectCommand(uploadParams));
    console.log(`Successfully uploaded ${localFilePath} to ${S3_BUCKET_NAME}/${s3Key}`);
    return `Successfully uploaded ${localFilePath} to ${S3_BUCKET_NAME}/${s3Key}`;
  } catch (err: unknown) {
    if (isAuthError(err)) {
      console.error("S3 uploadOriginalToS3 failed: Authentication token expired or invalid. Please refresh your credentials.");
      throw new Error("S3 operation failed due to expired or invalid credentials.");
    } else {
      console.error("Error uploading original file to S3:", err);
      throw err;
    }
  }
}

export async function uploadSplitFilesToS3(localFilePaths: string[], s3Prefix: string): Promise<string[]> {
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
      console.log(`Successfully uploaded ${localFilePath} to ${S3_BUCKET_NAME}/${s3Key}`);
    } catch (err: unknown) {
      if (isAuthError(err)) {
        console.error("S3 uploadSplitFilesToS3 failed: Authentication token expired or invalid. Please refresh your credentials.");
        throw new Error("S3 operation failed due to expired or invalid credentials.");
      } else {
        console.error(`Error uploading split file ${localFilePath} to S3:`, err);
        throw err;
      }
    }
  }
  return uploadedKeys;
}

console.log(
  "AWS_ACCESS_KEY_ID:",
  process.env.AWS_ACCESS_KEY_ID ? "SET" : "NOT SET"
);
console.log(
  "AWS_SECRET_ACCESS_KEY:",
  process.env.AWS_SECRET_ACCESS_KEY ? "SET" : "NOT SET"
); // Don't log the actual secret
console.log(
  "AWS_SESSION_TOKEN:",
  process.env.AWS_SESSION_TOKEN ? "SET" : "NOT SET"
);
console.log("AWS_DEFAULT_REGION:", process.env.AWS_DEFAULT_REGION);

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

    // The httpUploadProgress event is too noisy for 200k files.
    // We will only send a single message when the upload is done.
    // upload.on("httpUploadProgress", (progress) => { ... });

    await upload.done();
  } catch (err: unknown) {
    if (isAuthError(err)) {
      console.error(
        `S3 uploadFile failed for ${key}: Authentication token expired or invalid. Please refresh your credentials.`
      );
      throw new Error(
        "S3 upload failed due to expired or invalid credentials."
      );
    } else {
      console.error(`S3 uploadFile error for ${key}:`, err);
      throw err;
    }
  }
}

async function performIterativeUpload(
  localDir: string,
  bucket: string,
  prefix: string
) {
  console.log(`S3 upload process initiated for ${localDir}. Progress will be shown via WebSocket.`);
  console.log(`[performIterativeUpload] Starting for localDir: ${localDir}, prefix: ${prefix}`);

  let totalDirectories = 0;
  const directoryQueue: { localPath: string; s3Prefix: string; isClientCodeParent: boolean }[] = [];

  const initialDirName = path.basename(localDir);
  const isInitialDirClientCode = /^CLIENT_CODE_\d+$/.test(initialDirName);

  if (!isInitialDirClientCode) {
    // If the root directory is NOT a CLIENT_CODE_ directory, count it and its children normally.
    totalDirectories = countTrackedDirectories(localDir, false);
    directoryQueue.push({ localPath: localDir, s3Prefix: prefix, isClientCodeParent: false });
  } else {
    // If the root directory IS a CLIENT_CODE_ directory, don't count it, but count its children.
    // Add its children to the queue directly, marking them as being inside a CLIENT_CODE_ parent.
    const entries = fs.readdirSync(localDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const entryPath = path.join(localDir, entry.name);
        const entryKey = `${prefix}/${entry.name}`;
        totalDirectories += countTrackedDirectories(entryPath, true); // Count children of CLIENT_CODE_ dir
        directoryQueue.push({ localPath: entryPath, s3Prefix: entryKey, isClientCodeParent: true });
      }
    }
  }

  console.log(`[performIterativeUpload] Calculated totalDirectories: ${totalDirectories}`);

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
    console.log(`[performIterativeUpload] No directories to upload for ${localDir}. Returning.`);
    return { successfulFilesCount: 0, failedFilesCount: 0, failedFileDetails: [] };
  }

  // Send the total number of directories to the client at the very beginning.
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
    failedFileDetails: [] as { name: string; error: string }[], // Optionally keep a few error details
  };

  while (directoryQueue.length > 0) {
    const { localPath, s3Prefix, isClientCodeParent } = directoryQueue.shift()!; // Using as a queue
    const currentDirName = path.basename(localPath);
    const isCurrentDirClientCode = /^CLIENT_CODE_\d+$/.test(currentDirName);

    console.log(`[performIterativeUpload] Processing directory: ${localPath}, s3Prefix: ${s3Prefix}, isClientCodeParent: ${isClientCodeParent}, isCurrentDirClientCode: ${isCurrentDirClientCode}`);

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
            directoryQueue.push({ localPath: entryPath, s3Prefix: entryKey, isClientCodeParent: isClientCodeParent || isCurrentDirClientCode });
          } else {
            const fileUploadPromise = (async () => {
              try {
                await uploadFile(entryPath, bucket, entryKey);
                successfulFilesCount++;
              } catch (uploadError: unknown) {
                failedFilesCount++;
                results.failedFileDetails.push({
                  name: entry.name,
                  error: uploadError instanceof Error ? uploadError.message : 'Unknown upload error',
                });
              }
            })();
            uploadPromises.push(fileUploadPromise);
          }
        }
        await Promise.all(uploadPromises);

        // After all files in the current directory batch are processed, increment completedDirectories
        // and send a progress update for the directory.
        if (i + batchSize >= entries.length) {
          // Increment if it's a tracked directory (i.e., not a CLIENT_CODE_ parent that was skipped)
          if (isClientCodeParent || !isCurrentDirClientCode) {
              completedDirectories++;
              console.log(`[performIterativeUpload] Broadcasting s3-directory-progress: completedDirectories: ${completedDirectories}, totalDirectories: ${totalDirectories}, currentDirectory: ${s3Prefix}`);
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
        const errorMessage = `S3 upload failed for ${localPath}: Authentication token expired or invalid. Please refresh your credentials.`;
        console.error(errorMessage);
        throw new Error(errorMessage);
      } else {
        console.error(`S3 upload error for ${localPath}:`, err instanceof Error ? err.message : err);
        failedFilesCount++;
        results.failedFileDetails.push({ name: localPath, error: err instanceof Error ? err.message : 'Unknown directory upload error' });
      }
    }
  }

  results.successfulFilesCount = successfulFilesCount;
  results.failedFilesCount = failedFilesCount;

  // Send a final message to signify the overall completion of the directory upload.
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

  console.log(`[performIterativeUpload] Completed for localDir: ${localDir}. Results: successfulFilesCount: ${successfulFilesCount}, failedFilesCount: ${failedFilesCount}`);
  return results;
}

export async function uploadDirectoryRecursive(
  localDir: string,
  bucket: string,
  prefix: string
) {
  return performIterativeUpload(localDir, bucket, prefix);
}

export async function uploadSplitFilesToS3(
  localDir: string,
  bucket: string,
  prefix: string
) {
  return performIterativeUpload(localDir, bucket, prefix);
}
