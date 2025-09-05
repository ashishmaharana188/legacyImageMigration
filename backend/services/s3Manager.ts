import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { S3_BUCKET_NAME } from "../utils/s3Config";

const s3 = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    sessionToken: process.env.AWS_SESSION_TOKEN!,
  },
});

export async function listFiles(prefix: string): Promise<string[]> {
  const command = new ListObjectsV2Command({
    Bucket: S3_BUCKET_NAME,
    Prefix: prefix,
  });

  try {
    let isTruncated = true;
    let contents: string[] = [];
    let continuationToken;

    while (isTruncated) {
      const { Contents, IsTruncated, NextContinuationToken } = await s3.send(command);
      if (Contents) {
        contents = contents.concat(Contents.map(c => c.Key!));
      }
      isTruncated = IsTruncated!;
      continuationToken = NextContinuationToken;
      command.input.ContinuationToken = continuationToken;
    }
    console.log(`Found ${contents.length} files with prefix "${prefix}".`);
    return contents;
  } catch (err) {
    console.error(err);
    return [];
  }
}
