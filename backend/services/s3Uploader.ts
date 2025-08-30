import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";


const s3 = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  },
});

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
      const fileStream = fs.createReadStream(entryPath);
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: entryKey,
          Body: fileStream,
        })
      );
      console.log(`[UPLOADED] ${entryKey}`);
    }
  }
}
