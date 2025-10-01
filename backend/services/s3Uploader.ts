import { S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs";
import path from "path";
import https from "https";
import { broadcast } from "./webSocketService";

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
    sessionToken: process.env.AWS_SESSION_TOKEN!,
  },
  requestHandler: new NodeHttpHandler({
    httpsAgent: agent,
  }),
});

function isAuthError(error: any): boolean {
  return (
    error.name === "ExpiredToken" ||
    error.Code === "InvalidToken" || // Check for error.Code
    (error.message &&
      (error.message.includes("token expired") ||
        error.message.includes("InvalidToken") || // Check for InvalidToken in message
        error.message.includes("Token-0"))) // Check for Token-0 in message
  );
}

function countFilesRecursive(dir: string): number {
  let count = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        count += countFilesRecursive(entryPath);
      } else {
        count++;
      }
    }
  } catch (err) {
    console.error(`Error counting files in ${dir}:`, err);
  }
  return count;
}

export async function uploadFile(
  localFilePath: string,
  bucket: string,
  key: string,
  fileName: string
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

    // Send a simple, lightweight message for each successful upload.
    broadcast(JSON.stringify({ type: "s3-upload-progress" }));

    console.log(`[UPLOADED] ${key}`);
  } catch (err: any) {
    if (isAuthError(err)) {
      console.error(
        `S3 uploadFile failed for ${key}: Authentication token expired or invalid. Please refresh your credentials.`
      );
      throw new Error("S3 upload failed due to expired or invalid credentials.");
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
  const totalFiles = countFilesRecursive(localDir);
  if (totalFiles === 0) {
    broadcast(
      JSON.stringify({
        type: "complete",
        fileName: prefix,
        status: "Done",
        isDirectory: true,
        totalFiles: 0,
      })
    );
    return { successful: [], failed: [] };
  }

  // Send the total number of files to the client at the very beginning.
  broadcast(
    JSON.stringify({
      type: "s3-upload-total",
      totalFiles: totalFiles,
    })
  );

  let uploadedFiles = 0;
  const results = {
    successful: [] as string[],
    failed: [] as { name: string; error: string }[],
  };
  const directoryQueue: { localPath: string; s3Prefix: string }[] = [
    { localPath: localDir, s3Prefix: prefix },
  ];

  // The detailed, per-directory progress is no longer needed with the aggregate counter.
  // broadcast(
  //   JSON.stringify({
  //     type: "progress",
  //     fileName: prefix,
  //     progress: 0,
  //     status: "In progress",
  //     isDirectory: true,
  //     totalFiles: totalFiles,
  //   })
  // );

  // The updateProgress function is no longer needed as we send incremental updates.
  // const updateProgress = () => { ... };

  while (directoryQueue.length > 0) {
    const { localPath, s3Prefix } = directoryQueue.shift()!; // Using as a queue
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
            // Announcing individual directories is too noisy.
            // broadcast(
            //   JSON.stringify({
            //     type: "progress",
            //     fileName: entryKey,
            //     status: "Starting...",
            //     isDirectory: true,
            //   })
            // );
            directoryQueue.push({ localPath: entryPath, s3Prefix: entryKey });
          } else {
            const fileUploadPromise = (async () => {
              try {
                await uploadFile(entryPath, bucket, entryKey, entry.name);
                results.successful.push(entry.name);
                uploadedFiles++;
                // updateProgress(); // No longer needed
              } catch (uploadError: any) {
                results.failed.push({
                  name: entry.name,
                  error: uploadError.message,
                });
              }
            })();
            uploadPromises.push(fileUploadPromise);
          }
        }
        await Promise.all(uploadPromises);
      }
    } catch (err: any) {
      if (isAuthError(err)) {
        const errorMessage = `S3 upload failed for ${localPath}: Authentication token expired or invalid. Please refresh your credentials.`;
        console.error(errorMessage);
        throw new Error(errorMessage);
      } else {
        console.error(`S3 upload error for ${localPath}:`, err);
        results.failed.push({ name: localPath, error: err.message });
      }
    }
  }

  // Send a final message to signify the overall completion of the directory upload.
  broadcast(
    JSON.stringify({
      type: "complete",
      fileName: prefix,
      status: "Done",
      isDirectory: true,
    })
  );

  return results;
}

export async function uploadDirectoryRecursive(
  localDir: string,
  bucket: string,
  prefix: string
) {
  return performIterativeUpload(
    localDir,
    bucket,
    prefix
  );
}

export async function uploadSplitFilesToS3(
  localDir: string,
  bucket: string,
  prefix: string
) {
  return performIterativeUpload(
    localDir,
    bucket,
    prefix
  );
}

