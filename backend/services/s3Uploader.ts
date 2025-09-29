import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs";
import path from "path";
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

const s3 = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    sessionToken: process.env.AWS_SESSION_TOKEN!,
  },
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

    upload.on("httpUploadProgress", (progress) => {
      if (progress.loaded !== undefined && progress.total !== undefined) {
        const percentage = Math.round((progress.loaded / progress.total) * 100);
        broadcast(
          JSON.stringify({
            type: "progress",
            fileName: key,
            progress: percentage,
            isDirectory: false,
          })
        );
      }
    });

    await upload.done();
    broadcast(
      JSON.stringify({
        type: "complete",
        fileName: key,
        status: "Done",
        isDirectory: false,
      })
    );
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

async function performRecursiveUpload(
  localDir: string,
  bucket: string,
  prefix: string,
  uploadFunction: (
    localDir: string,
    bucket: string,
    prefix: string
  ) => Promise<{ successful: string[]; failed: { name: string; error: string }[] }>
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
  let uploadedFiles = 0;

  broadcast(
    JSON.stringify({
      type: "progress",
      fileName: prefix,
      progress: 0,
      status: "In progress",
      isDirectory: true,
      totalFiles: totalFiles,
    })
  );

  const updateProgress = () => {
    const progress =
      totalFiles > 0 ? Math.round((uploadedFiles / totalFiles) * 100) : 100;
    broadcast(
      JSON.stringify({
        type: "progress",
        fileName: prefix,
        progress: progress,
        status: "In progress",
        isDirectory: true,
      })
    );
  };

  const results = {
    successful: [] as string[],
    failed: [] as { name: string; error: string }[],
  };

  try {
    const entries = fs.readdirSync(localDir, { withFileTypes: true });
    const batchSize = 50; // Set the batch size to 50

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const uploadPromises: Promise<void>[] = [];

      for (const entry of batch) {
        const entryPath = path.join(localDir, entry.name);
        const entryKey = `${prefix}/${entry.name}`;

        if (entry.isDirectory()) {
          const subDirPromise = (async () => {
            const subDirResults = await uploadFunction(
              entryPath,
              bucket,
              entryKey
            );
            results.successful.push(...subDirResults.successful);
            results.failed.push(...subDirResults.failed);
            const filesInSubDir = countFilesRecursive(entryPath);
            uploadedFiles += filesInSubDir;
            updateProgress();
          })();
          uploadPromises.push(subDirPromise);
        } else {
          const fileUploadPromise = (async () => {
            try {
              await uploadFile(entryPath, bucket, entryKey, entry.name);
              results.successful.push(entry.name);
              uploadedFiles++;
              updateProgress();
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

    broadcast(
      JSON.stringify({
        type: "complete",
        fileName: prefix,
        status: "Done",
        isDirectory: true,
      })
    );
    return results;
  } catch (err: any) {
    if (isAuthError(err)) {
      console.error(
        `S3 recursive upload failed for ${localDir}: Authentication token expired or invalid. Please refresh your credentials.`
      );
      throw new Error(
        "S3 upload failed due to expired or invalid credentials."
      );
    } else {
      console.error(`S3 recursive upload error for ${localDir}:`, err);
      throw err;
    }
  }
}

export async function uploadDirectoryRecursive(
  localDir: string,
  bucket: string,
  prefix: string
) {
  return performRecursiveUpload(
    localDir,
    bucket,
    prefix,
    uploadDirectoryRecursive
  );
}

export async function uploadSplitFilesToS3(
  localDir: string,
  bucket: string,
  prefix: string
) {
  return performRecursiveUpload(
    localDir,
    bucket,
    prefix,
    uploadSplitFilesToS3
  );
}

