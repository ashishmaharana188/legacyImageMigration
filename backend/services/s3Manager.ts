import { S3Client, ListObjectsV2Command, DeleteObjectsCommand, ObjectIdentifier } from "@aws-sdk/client-s3";
import { S3_BUCKET_NAME } from "../utils/s3Config";

const s3 = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    sessionToken: process.env.AWS_SESSION_TOKEN!,
  },
});

interface S3ListResponse {
  directories: string[];
  files: { key: string; lastModified: Date | undefined }[];
  nextContinuationToken?: string;
}

export async function listFiles(
  prefix: string,
  continuationToken?: string
): Promise<S3ListResponse> {
  const command = new ListObjectsV2Command({
    Bucket: S3_BUCKET_NAME,
    Prefix: prefix,
    Delimiter: "/",
    ContinuationToken: continuationToken,
  });

  try {
    const { Contents, CommonPrefixes, NextContinuationToken } = await s3.send(
      command
    );

    const page: S3ListResponse = {
      directories: CommonPrefixes?.map((p) => p.Prefix!) || [],
      files: Contents?.map((c) => ({ key: c.Key!, lastModified: c.LastModified })) || [],
      nextContinuationToken: NextContinuationToken,
    };

    return page;
  } catch (err) {
    console.error(err);
    throw err; // Re-throw to be handled by controller
  }
}

export async function deleteFiles(keys: string[]): Promise<string[]> {
    const filesToDelete = keys.filter(key => !key.endsWith('/'));
  
    if (filesToDelete.length === 0) {
      console.log("No files to delete.");
      return [];
    }
  
    const deleteParams = {
      Bucket: S3_BUCKET_NAME,
      Delete: {
        Objects: filesToDelete.map(key => ({ Key: key })) as ObjectIdentifier[],
      },
    };
  
    const command = new DeleteObjectsCommand(deleteParams);
  
    try {
      const { Deleted } = await s3.send(command);
      const deletedKeys = Deleted?.map(d => d.Key!) || [];
      console.log(`Successfully deleted ${deletedKeys.length} files from S3.`);
      return deletedKeys;
    } catch (err) {
      console.error("Error deleting files from S3:", err);
      return [];
    }
  }

export async function searchFiles(prefix: string, pattern: string): Promise<{ key: string; lastModified: Date | undefined }[]> {
  const command = new ListObjectsV2Command({
    Bucket: S3_BUCKET_NAME,
    Prefix: prefix,
  });

  const matchedFiles: { key: string; lastModified: Date | undefined }[] = [];
  const regex = new RegExp(pattern);

  try {
    let isTruncated = true;
    let continuationToken;

    while (isTruncated) {
      const { Contents, IsTruncated, NextContinuationToken } = await s3.send(command);

      if (Contents) {
        const matchingObjects = Contents.filter(c => c.Key && regex.test(c.Key));
        matchedFiles.push(...matchingObjects.map(c => ({ key: c.Key!, lastModified: c.LastModified })));
      }

      isTruncated = IsTruncated!;
      continuationToken = NextContinuationToken;
      command.input.ContinuationToken = continuationToken;
    }

    return matchedFiles;
  } catch (err) {
    console.error("Error searching files:", err);
    throw err;
  }
}