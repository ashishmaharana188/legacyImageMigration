import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
} from "@aws-sdk/client-athena";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { S3_BUCKET_NAME, getAthenaResultsPrefix } from "./s3Config";
import { Readable } from "stream";

// 1. Setup specific credentials if provided in the .env file
const athenaCredentials =
  process.env.ATHENA_AWS_ACCESS_KEY_ID &&
  process.env.ATHENA_AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.ATHENA_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.ATHENA_AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.ATHENA_AWS_SESSION_TOKEN,
      }
    : undefined; // Falls back to default AWS credentials if undefined

const region = process.env.AWS_REGION || "ap-south-1";

// 2. Initialize localized clients using the specific credentials
const athenaClient = new AthenaClient({
  region,
  credentials: athenaCredentials,
});

// The S3 client that fetches the CSV must ALSO use the Dev credentials
// because Athena writes to the Dev bucket!
const athenaS3Client = new S3Client({
  region,
  credentials: athenaCredentials,
});

// Use the explicit Athena bucket from .env, or fallback to the default S3 config
const ATHENA_BUCKET =
  process.env.ATHENA_S3_BUCKET_NAME || "aif-in-a-box-assets-dev";
const streamToString = (stream: Readable): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });

export async function runAndDownloadAthenaQuery(
  sqlQuery: string
): Promise<string> {
  const prefix = getAthenaResultsPrefix();

  // Explicitly point the output location to the Dev bucket
  const outputLocation = `s3://${ATHENA_BUCKET}/${prefix}`;

  const startCommand = new StartQueryExecutionCommand({
    QueryString: sqlQuery,
    QueryExecutionContext: {
      Catalog: "AwsDataCatalog",
      Database: "aif_mirror_1",
    },
    ResultConfiguration: {
      OutputLocation: outputLocation,
    },
  });

  const startResponse = await athenaClient.send(startCommand);
  const queryExecutionId = startResponse.QueryExecutionId;

  if (!queryExecutionId) throw new Error("Failed to start Athena query");

  let isRunning = true;
  while (isRunning) {
    const statusCommand = new GetQueryExecutionCommand({
      QueryExecutionId: queryExecutionId,
    });
    const statusResponse = await athenaClient.send(statusCommand);
    const state = statusResponse.QueryExecution?.Status?.State;

    if (state === "SUCCEEDED") {
      isRunning = false;
    } else if (state === "FAILED" || state === "CANCELLED") {
      const reason = statusResponse.QueryExecution?.Status?.StateChangeReason;
      throw new Error(`Athena Query ${state}. Reason: ${reason}`);
    } else {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  const s3Key = `${prefix}${queryExecutionId}.csv`;
  const getObjectCommand = new GetObjectCommand({
    Bucket: ATHENA_BUCKET, // Point to the Dev bucket
    Key: s3Key,
  });

  // Use the Dev-authenticated S3 client to download it
  const s3Response = await athenaS3Client.send(getObjectCommand);

  if (!s3Response.Body) throw new Error("S3 returned an empty body");

  return await streamToString(s3Response.Body as Readable);
}
