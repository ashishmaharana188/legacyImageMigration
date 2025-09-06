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

export async function uploadFile(
  localFilePath: string,
  bucket: string,
  key: string
) {
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
}

export async function uploadDirectoryRecursive(
  localDir: string,
  bucket: string,
  prefix: string
) {
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
}

export async function uploadSplitFilesToS3(
  localDir: string,
  bucket: string,
  prefix: string
) {
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
}
>>>>>>> 8488510bd23ce93b57e60f5a7bf43b7f24ff4b73
