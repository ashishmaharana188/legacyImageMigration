import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs";
import path from "path";

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

    upload.on("httpUploadProgress", (progress) => {
      if (progress.loaded !== undefined && progress.total !== undefined) {
        console.log(
          `[PROGRESS] ${key}: ${progress.loaded}/${progress.total} (${(
            (progress.loaded / progress.total) *
            100
          ).toFixed(2)}%)`
        );
      } else {
        console.log(
          `[PROGRESS] ${key}: Progress update (loaded or total is undefined)`
        );
      }
    });

    await upload.done();
    console.log(`[UPLOADED] ${key}`);
  } catch (err: any) {
    if (isAuthError(err)) {
      console.error(`S3 uploadFile failed for ${key}: Authentication token expired or invalid. Please refresh your credentials.`);
      throw new Error("S3 upload failed due to expired or invalid credentials.");
    } else {
      console.error(`S3 uploadFile error for ${key}:`, err);
      throw err;
    }
  }
}

export async function uploadDirectoryRecursive(
  localDir: string,
  bucket: string,
  prefix: string
) {
  try {
    const entries = fs.readdirSync(localDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(localDir, entry.name);
      const entryKey = `${prefix}/${entry.name}`;

      if (entry.isDirectory()) {
        // Recurse into subdirectory
        await uploadDirectoryRecursive(entryPath, bucket, entryKey);
      } else {
        // Upload file
        await uploadFile(entryPath, bucket, entryKey);
      }
    }
  } catch (err: any) {
    if (isAuthError(err)) {
      console.error(`S3 uploadDirectoryRecursive failed for ${localDir}: Authentication token expired or invalid. Please refresh your credentials.`);
      throw new Error("S3 upload failed due to expired or invalid credentials.");
    } else {
      console.error(`S3 uploadDirectoryRecursive error for ${localDir}:`, err);
      throw err;
    }
  }
}

export async function uploadSplitFilesToS3(
  localDir: string,
  bucket: string,
  prefix: string
) {
  try {
    const entries = fs.readdirSync(localDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(localDir, entry.name);
      const entryKey = `${prefix}/${entry.name}`;

      if (entry.isDirectory()) {
        // Recurse into subdirectory
        await uploadSplitFilesToS3(entryPath, bucket, entryKey);
      } else {
        // Upload file
        await uploadFile(entryPath, bucket, entryKey);
      }
    }
  } catch (err: any) {
    if (isAuthError(err)) {
      console.error(`S3 uploadSplitFilesToS3 failed for ${localDir}: Authentication token expired or invalid. Please refresh your credentials.`);
      throw new Error("S3 upload failed due to expired or invalid credentials.");
    } else {
      console.error(`S3 uploadSplitFilesToS3 error for ${localDir}:`, err);
      throw err;
    }
  }
}
