import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  ObjectIdentifier,
  ListBucketsCommand,
  ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "https";
import { S3_BUCKET_NAME } from "../utils/s3Config";
import logger from "../utils/logger";

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

export async function listAllFoldersAndFileCounts(
  basePrefix: string
): Promise<Map<string, number>> {
  const folderFileCounts = new Map<string, number>();
  const uniqueFolders = new Set<string>();
  let continuationToken: string | undefined = undefined;

  logger.debug({
    category: "s3-operations",
    function: "listAllFoldersAndFileCounts",
    message: `Starting iterative listing for base prefix: ${basePrefix}`,
  });

  do {
    logger.debug({
      category: "s3-operations",
      function: "listAllFoldersAndFileCounts",
      message: `Fetching objects for prefix: ${basePrefix}, continuationToken: ${continuationToken || "none"}`,
    });

    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET_NAME,
      Prefix: basePrefix,
      // No Delimiter here to get all objects (files and 'subfolders' as full keys)
      ContinuationToken: continuationToken,
      MaxKeys: 1000, // Fetch up to 1000 keys per request
    });

    try {
      const response: ListObjectsV2CommandOutput = await s3.send(command);
      const { Contents, CommonPrefixes, NextContinuationToken } = response;

      logger.debug({
        category: "s3-operations",
        function: "listAllFoldersAndFileCounts",
        message: `Received S3 response. Files: ${Contents?.length || 0}, CommonPrefixes: ${CommonPrefixes?.length || 0}`,
      });

      // Process files (Contents)
      if (Contents) {
        for (const content of Contents) {
          if (content.Key && content.Key !== basePrefix) { // Exclude the base prefix itself if it's a 'file' representation
            // Extract the parent folder for the file
            const lastSlashIndex = content.Key.lastIndexOf('/');
            let parentFolder = '';
            if (lastSlashIndex > -1) {
              parentFolder = content.Key.substring(0, lastSlashIndex + 1); // Include the trailing slash
            } else {
              // If no slash, it's a file directly under the basePrefix (root of the current listing)
              parentFolder = basePrefix; // Or '' if you want to represent root as empty string
            }

            // Ensure the parent folder is in our unique set
            if (parentFolder) {
              uniqueFolders.add(parentFolder);
            }

            // Increment file count for the parent folder, but only if it's an actual file (not a folder marker)
            if (!content.Key.endsWith('/')) { // Only count actual files
              folderFileCounts.set(parentFolder, (folderFileCounts.get(parentFolder) || 0) + 1);
            }
          }
        }
      }

      // Process common prefixes (explicitly listed directories if Delimiter was used, but we're not using it here)
      // However, if S3 returns CommonPrefixes even without Delimiter (e.g., for empty folders), we should add them.
      if (CommonPrefixes) {
        for (const commonPrefix of CommonPrefixes) {
          if (commonPrefix.Prefix) {
            uniqueFolders.add(commonPrefix.Prefix);
          }
        }
      }

      continuationToken = NextContinuationToken;
      logger.debug({
        category: "s3-operations",
        function: "listAllFoldersAndFileCounts",
        message: `Next continuation token: ${continuationToken || "none"}`,
      });

    } catch (err: any) {
      if (isAuthError(err)) {
        logger.error({
          category: "s3-operations",
          function: "listAllFoldersAndFileCounts",
          message: "S3 listAllFoldersAndFileCounts failed: Authentication token expired or invalid.",
          error: err.message,
        });
        throw new Error("S3 operation failed due to expired or invalid credentials.");
      } else {
        logger.error({
          category: "s3-operations",
          function: "listAllFoldersAndFileCounts",
          message: "S3 listAllFoldersAndFileCounts error during S3 API call.",
          error: err.message,
          stack: err.stack,
        });
        throw err; // Re-throw to be handled by controller
      }
    }
  } while (continuationToken);

  // Ensure all identified folders are in the map, even if they have 0 files
  for (const folder of uniqueFolders) {
    if (!folderFileCounts.has(folder)) {
      folderFileCounts.set(folder, 0);
    }
  }

  logger.debug({
    category: "s3-operations",
    function: "listAllFoldersAndFileCounts",
    message: `Finished iterative listing for base prefix: ${basePrefix}. Total unique folders: ${uniqueFolders.size}, Total folders with counts: ${folderFileCounts.size}`,
  });

  return folderFileCounts;
}
