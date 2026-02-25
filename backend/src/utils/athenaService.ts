import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand } from "@aws-sdk/client-athena";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { S3_BUCKET_NAME, getAthenaResultsPrefix } from "./s3Config";
import { Readable } from "stream";

const athenaClient = new AthenaClient({ region: process.env.AWS_REGION || "ap-south-1" });
const s3Client = new S3Client({ region: process.env.AWS_REGION || "ap-south-1" });

const streamToString = (stream: Readable): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });

export async function runAndDownloadAthenaQuery(sqlQuery: string): Promise<string> {
  const prefix = getAthenaResultsPrefix();
  const outputLocation = `s3://${S3_BUCKET_NAME}/${prefix}`; // s3://aif-in-a-box-assets-dev/Data/APPLICATION_FORMS/athenresults/

  // 1. Start the Query using your exact configuration
  const startCommand = new StartQueryExecutionCommand({
    QueryString: sqlQuery,
    QueryExecutionContext: {
      Catalog: "AwsDataCatalog", // Explicitly set Catalog
      Database: "aif_mirror_1",  // Explicitly set Database
    },
    ResultConfiguration: {
      OutputLocation: outputLocation,
    },
  });

  const startResponse = await athenaClient.send(startCommand);
  const queryExecutionId = startResponse.QueryExecutionId;

  if (!queryExecutionId) throw new Error("Failed to start Athena query");

  // 2. Poll until SUCCEEDED
  let isRunning = true;
  while (isRunning) {
    const statusCommand = new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId });
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

  // 3. Download the resulting CSV (Athena automatically names it {QueryExecutionId}.csv)
  const s3Key = `${prefix}${queryExecutionId}.csv`;
  const getObjectCommand = new GetObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
  });

  const s3Response = await s3Client.send(getObjectCommand);
  if (!s3Response.Body) throw new Error("S3 returned an empty body");

  return await streamToString(s3Response.Body as Readable);
}
