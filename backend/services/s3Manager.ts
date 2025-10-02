import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  ObjectIdentifier,
  ListBucketsCommand,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "https";
import { S3_BUCKET_NAME } from "../utils/s3Config";

const agent = new https.Agent({
  maxSockets: 200,
});

// Check for essential AWS credentials
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const sessionToken = process.env.AWS_SESSION_TOKEN; // Often required for temporary credentials
const region = process.env.AWS_DEFAULT_REGION || "ap-south-1";

if (!accessKeyId || !secretAccessKey) {
  const errorMessage =
    "AWS credentials are not configured properly. Please ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables are set.";
  console.error(errorMessage);
  throw new Error(errorMessage);
}

const s3 = new S3Client({
  region: region,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
    sessionToken: sessionToken, // Pass sessionToken if it exists
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

export async function verifyS3Connection(): Promise<void> {
  try {
    console.log("Verifying S3 connection...");
    await s3.send(new ListBucketsCommand({}));
    console.log("S3 connection successful.");
  } catch (error: any) {
    if (isAuthError(error)) {
      console.error("S3 connection failed: Authentication token expired or invalid. Please refresh your credentials.");
    } else {
      console.error("S3 connection failed:", error.message || error);
    }
  }
}

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
    const { Contents, CommonPrefixes, IsTruncated, NextContinuationToken } =
      await s3.send(command);


    const page: S3ListResponse = {
      directories: CommonPrefixes?.map((p) => p.Prefix!) || [],
      files:
        Contents?.map((c) => ({ key: c.Key!, lastModified: c.LastModified })) ||
        [],
      nextContinuationToken: NextContinuationToken,
    };

    return page;
  } catch (err: any) {
    if (isAuthError(err)) {
      console.error("S3 listFiles failed: Authentication token expired or invalid. Please refresh your credentials.");
      throw new Error("S3 operation failed due to expired or invalid credentials.");
    } else {
      console.error("S3 listFiles error:", err);
      throw err; // Re-throw to be handled by controller
    }
  }
}

export async function deleteFiles(keys: string[]): Promise<string[]> {
  const filesToDelete = keys.filter((key) => !key.endsWith("/"));

  if (filesToDelete.length === 0) {
    console.log("No files to delete.");
    return [];
  }

  const deleteParams = {
    Bucket: S3_BUCKET_NAME,
    Delete: {
      Objects: filesToDelete.map((key) => ({ Key: key })) as ObjectIdentifier[],
    },
  };

  const command = new DeleteObjectsCommand(deleteParams);

  try {
    const { Deleted } = await s3.send(command);
    const deletedKeys = Deleted?.map((d) => d.Key!) || [];
    console.log(`Successfully deleted ${deletedKeys.length} files from S3.`);
    return deletedKeys;
  } catch (err: any) {
    if (isAuthError(err)) {
      console.error("S3 deleteFiles failed: Authentication token expired or invalid. Please refresh your credentials.");
      throw new Error("S3 operation failed due to expired or invalid credentials.");
    } else {
      console.error("Error deleting files from S3:", err);
      return [];
    }
  }
}

export async function searchFiles(
  prefix: string,
  pattern: string,
  continuationToken?: string
): Promise<{
  files: { key: string; lastModified: Date | undefined }[];
  nextContinuationToken?: string;
}> {
  const matchedFiles: { key: string; lastModified: Date | undefined }[] = [];
  const regex = new RegExp(pattern);

  try {

    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 100,
    });

    const { Contents, IsTruncated, NextContinuationToken } = await s3.send(
      command
    );


    if (Contents) {
      // Log the keys before filtering
      console.log(
        "Keys from S3:",
        Contents.map((c) => c.Key)
      );

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
      nextContinuationToken: IsTruncated ? NextContinuationToken : undefined,
    };
  } catch (err: any) {
    if (isAuthError(err)) {
      console.error("S3 searchFiles failed: Authentication token expired or invalid. Please refresh your credentials.");
      throw new Error("S3 operation failed due to expired or invalid credentials.");
    } else {
      console.error("Error searching files:", err);
      throw err;
    }
  }
}

export async function searchFolders(
  prefix: string,
  pattern: string,
  continuationToken?: string
): Promise<{
  directories: string[];
  nextContinuationToken?: string;
}> {
  const matchedDirectories: string[] = [];
  const regex = new RegExp(pattern, "i");

  try {
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET_NAME,
      Prefix: prefix,
      Delimiter: "/",
      ContinuationToken: continuationToken,
    });

    const { CommonPrefixes, IsTruncated, NextContinuationToken } =
      await s3.send(command);

    if (CommonPrefixes) {
      const matchingPrefixes =
        CommonPrefixes.filter((p) => {
          if (!p.Prefix) return false;
          // Extract the last part of the prefix (the folder name)
          const parts = p.Prefix.split("/").filter(Boolean);
          const folderName = parts.pop();
          return folderName ? regex.test(folderName) : false;
        }).map((p) => p.Prefix!) || [];
      matchedDirectories.push(...matchingPrefixes);
    }

    return {
      directories: matchedDirectories,
      nextContinuationToken: IsTruncated ? NextContinuationToken : undefined,
    };
  } catch (err: any) {
    if (isAuthError(err)) {
      console.error("S3 searchFolders failed: Authentication token expired or invalid. Please refresh your credentials.");
      throw new Error("S3 operation failed due to expired or invalid credentials.");
    } else {
      console.error("Error searching folders:", err);
      throw err;
    }
  }
}
