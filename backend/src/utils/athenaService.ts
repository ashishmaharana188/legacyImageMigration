import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
} from "@aws-sdk/client-athena";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getAthenaResultsPrefix } from "./s3Config";
import { Readable } from "stream";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "https";

// 1) INSECURE: create an HTTPS agent that skips cert verification
const insecureHttpsAgent = new https.Agent({
  rejectUnauthorized: false, // ⚠️ DISABLES TLS VERIFICATION
});

// 2) Attach the agent to a NodeHttpHandler
const insecureRequestHandler = new NodeHttpHandler({
  httpsAgent: insecureHttpsAgent,
});

// 3) Credentials and region
const athenaCredentials =
  process.env.ATHENA_AWS_ACCESS_KEY_ID && process.env.ATHENA_AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.ATHENA_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.ATHENA_AWS_SECRET_ACCESS_KEY!,
        sessionToken: process.env.ATHENA_AWS_SESSION_TOKEN,
      }
    : undefined;

const region = process.env.AWS_REGION || "ap-south-1";

// 4) Initialize clients with the insecure requestHandler
const athenaClient = new AthenaClient({
  region,
  credentials: athenaCredentials,
  requestHandler: insecureRequestHandler, // 👈
});

const athenaS3Client = new S3Client({
  region,
  credentials: athenaCredentials,
  requestHandler: insecureRequestHandler, // 👈
});

const ATHENA_BUCKET = process.env.ATHENA_S3_BUCKET_NAME || "aif-in-a-box-assets-dev";

const streamToString = (stream: Readable): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });

export async function runAndDownloadAthenaQuery(sqlQuery: string): Promise<string> {
  const prefix = getAthenaResultsPrefix();
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
    const statusResponse = await athenaClient.send(
      new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId })
    );
    const state = statusResponse.QueryExecution?.Status?.State;
    if (state === "SUCCEEDED") {
      isRunning = false;
    } else if (state === "FAILED" || state === "CANCELLED") {
      const reason = statusResponse.QueryExecution?.Status?.StateChangeReason;
      throw new Error(`Athena Query ${state}. Reason: ${reason}`);
    } else {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const s3Key = `${prefix}${queryExecutionId}.csv`;
  const s3Response = await athenaS3Client.send(
    new GetObjectCommand({ Bucket: ATHENA_BUCKET, Key: s3Key })
  );
  if (!s3Response.Body) throw new Error("S3 returned an empty body");

  return streamToString(s3Response.Body as Readable);
}
