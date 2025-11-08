import dotenv from "dotenv";
import os from "os";
import path from "path";
import * as fs from "fs";

// --- Environment Variable Loading ---
// This block MUST be at the very top of the file, before any other imports,
// to ensure all environment variables are loaded before any other code runs.
const isProduction = process.env.NODE_ENV === "production";
const envFile = isProduction ? ".env.production" : ".env.development";
const userConfigDir = path.join(os.homedir(), ".appConfig");
const envPath = path.join(userConfigDir, envFile);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`Loading environment variables from: ${envPath}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`USE_MONGO_SSH_TUNNEL: ${process.env.USE_MONGO_SSH_TUNNEL}`);
  console.log(`MONGO_URI: ${process.env.MONGO_URI ? "SET" : "NOT SET"}`);
  console.log(`LOCAL_URI: ${process.env.LOCAL_URI}`);
  console.log(`API_FRONTEND_URL: ${process.env.API_FRONTEND_URL}`);

  if (isProduction) {
    console.log("Connected to Prod database");
  } else {
    console.log("Connected to Dev database");
  }
} else {
  console.warn(`Warning: Environment file not found at: ${envPath}. Please ensure it exists.`);
}
// --- End of Environment Variable Loading ---

import express from "express";
import uploadProcessRouter from "./src/api/uploadProcessor/uploadProcessorApp";
import splitProcessorRouter from "./src/api/splitProcessor/splitProcessorApp";
import s3ProcessorRouter from "./src/api/s3Processor/s3ProcessorApp";
import cors from "cors";
import { startSshTunnel } from "./src/utils/tunnel";
import { connectMongo, disconnectMongo } from "./controllers/dbConnect"
import { warmupPgPool } from "./controllers/dbConnect";
import { verifyS3Connection } from "./services/s3Manager";
import { initWebSocket } from "./src/utils/webSocketService";

import { Server } from "net";

const app = express();
const port = process.env.NODE_ENV === 'production' ? 3000 : 3000;

app.use(cors({
  origin: process.env.API_FRONTEND_URL || "http://localhost:5173", // Allow requests from frontend
  credentials: true,
}));
app.use(express.json());

app.get("/config", (req, res) => {
  res.json({
    apiBaseUrl: process.env.APP_BASE_URL,
    frontendUrl: process.env.API_FRONTEND_URL,
  });
});

app.use(uploadProcessRouter);
app.use(splitProcessorRouter);
app.use(s3ProcessorRouter);

const startServer = async () => {
  let pgServer: Server | undefined;

  if (process.env.USE_SSH_TUNNEL === "true") {
    pgServer = await startSshTunnel();
  }

  try {
    await connectMongo();
    console.log("MongoDB connection established during startup.");
  } catch (error) {
    console.error(
      "Failed to establish MongoDB connection during startup:",
      error
    );
  }

  try {
    await warmupPgPool();
    console.log("PostgreSQL connection pool warmed up.");
  } catch (error) {
    console.error("Failed to warm up PostgreSQL connection pool:", error);
  }

  try {
    await verifyS3Connection();
    console.log("S3 connection verified.");
  } catch (error) {
    console.error("Failed to verify S3 connection:", error);
  }

  const expressServer = app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log("Express server listening, initializing WebSocket server...");
  });

  console.log("Type of expressServer before initWebSocket:", typeof expressServer);
  initWebSocket(expressServer);
  console.log("WebSocket server initialization attempted.");

  const gracefulShutdown = () => {
    console.log("Shutting down gracefully...");
    expressServer.close(() => {
      console.log("Closed out remaining connections.");
      if (pgServer) {
        pgServer.close();
        console.log("PostgreSQL SSH tunnel closed.");
      }
      disconnectMongo();
      process.exit(0);
    });
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
};

startServer();
