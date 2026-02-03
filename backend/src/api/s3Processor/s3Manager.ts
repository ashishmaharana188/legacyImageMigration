import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  ObjectIdentifier,
  ListBucketsCommand,
} from "@aws-sdk/client-s3";
import { isAuthError } from "./s3ProcessorUtil";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "https";
import {
  S3_BUCKET_NAME,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_SESSION_TOKEN,
  AWS_DEFAULT_REGION,
} from "../../../utils/s3Config";

const agent = new https.Agent({
  maxSockets: 200,
});

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !S3_BUCKET_NAME) {
  const errorMessage =
    "AWS credentials or S3 bucket name are not configured properly in the .env file.";
  throw new Error(errorMessage);
}

const s3 = new S3Client({
  region: AWS_DEFAULT_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    sessionToken: AWS_SESSION_TOKEN,
  },
  requestHandler: new NodeHttpHandler({
    httpsAgent: agent,
  }),
});

export async function verifyS3Connection(): Promise<void> {
  try {
    console.log("Verifying S3 connection...");
    await s3.send(new ListBucketsCommand({}));
    console.log("S3 connection successful.");
  } catch (error: unknown) {
    if (isAuthError(error)) {
      console.error(
        "S3 connection failed: Authentication token expired or invalid."
      );
    } else {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`S3 connection failed: ${msg}`);
    }
  }
}

interface S3ListResponse {
  directories: string[];
  files: { key: string; lastModified: Date | undefined }[];
  nextContinuationToken?: string;
}

// [FIX] Added maxKeys parameter (Default 1000)
export async function listFiles(
  prefix: string,
  continuationToken?: string,
  maxKeys: number = 1000
): Promise<S3ListResponse> {
  const command = new ListObjectsV2Command({
    Bucket: S3_BUCKET_NAME,
    Prefix: prefix,
    Delimiter: "/",
    ContinuationToken: continuationToken,
    MaxKeys: maxKeys, // [FIX] Apply limit here
  });

  try {
    const { Contents, CommonPrefixes, NextContinuationToken } = await s3.send(
      command
    );
    return {
      directories: CommonPrefixes?.map((p) => p.Prefix!) || [],
      files:
        Contents?.map((c) => ({ key: c.Key!, lastModified: c.LastModified })) ||
        [],
      nextContinuationToken: NextContinuationToken,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isAuthError(err)) {
      console.error("S3 listFiles failed: Authentication expired.");
      throw new Error("S3 Credentials Expired");
    } else {
      console.error(`S3 listFiles error: ${msg}`);
      throw new Error(msg);
    }
  }
}

export async function deleteFiles(keys: string[]): Promise<string[]> {
  const filesToDelete = keys.filter((key) => !key.endsWith("/"));
  if (filesToDelete.length === 0) return [];

  const command = new DeleteObjectsCommand({
    Bucket: S3_BUCKET_NAME,
    Delete: {
      Objects: filesToDelete.map((key) => ({ Key: key })) as ObjectIdentifier[],
    },
  });

  try {
    const { Deleted } = await s3.send(command);
    const deletedKeys = Deleted?.map((d) => d.Key!) || [];
    console.log(`Successfully deleted ${deletedKeys.length} files from S3.`);
    return deletedKeys;
  } catch (err: unknown) {
    if (isAuthError(err)) {
      console.error("S3 deleteFiles failed: Authentication expired.");
      throw new Error("S3 Credentials Expired");
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error deleting files from S3: ${msg}`);
      return [];
    }
  }
}

export async function searchFiles(
  prefix: string,
  pattern: string,
  continuationToken?: string
) {
  const matchedFiles: { key: string; lastModified: Date | undefined }[] = [];
  const regex = new RegExp(pattern);

  try {
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 100,
    });
    const { Contents, NextContinuationToken } = await s3.send(command);
    if (Contents) {
      const matchingObjects = Contents.filter(
        (c) => c.Key && regex.test(c.Key)
      );
      matchedFiles.push(
        ...matchingObjects.map((c) => ({
          key: c.Key!,
          lastModified: c.LastModified,
        }))
      );
    }
    return {
      files: matchedFiles,
      nextContinuationToken: NextContinuationToken,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error searching files: ${msg}`);
    throw new Error(msg);
  }
}

export async function searchFolders(
  prefix: string,
  pattern: string,
  continuationToken?: string
) {
  const matchedDirectories: string[] = [];
  const regex = new RegExp(pattern, "i");

  try {
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET_NAME,
      Prefix: prefix,
      Delimiter: "/",
      ContinuationToken: continuationToken,
    });
    const { CommonPrefixes, NextContinuationToken } = await s3.send(command);
    if (CommonPrefixes) {
      const matchingPrefixes =
        CommonPrefixes.filter((p) => {
          if (!p.Prefix) return false;
          const parts = p.Prefix.split("/").filter(Boolean);
          const folderName = parts.pop();
          return folderName ? regex.test(folderName) : false;
        }).map((p) => p.Prefix!) || [];
      matchedDirectories.push(...matchingPrefixes);
    }
    return {
      directories: matchedDirectories,
      nextContinuationToken: NextContinuationToken,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error searching folders: ${msg}`);
    throw new Error(msg);
  }
}
