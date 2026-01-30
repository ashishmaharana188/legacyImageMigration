import dotenv from "dotenv";
import os from "os";
import path from "path";
import fs from "fs";
import { WebSocketServer } from "ws";

// --- Environment Variable Loading ---
const isProduction = process.env.NODE_ENV === "production";
const envFile = isProduction ? ".env.production" : ".env.development";
const userConfigDir = path.join(os.homedir(), ".appConfig");
const envPath = path.join(userConfigDir, envFile);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`Loading environment variables from: ${envPath}`);
} else {
  console.warn(`Warning: Environment file not found at: ${envPath}`);
}
// --- End of Environment Variable Loading ---

import express from "express";
import uploadProcessRouter from "./src/api/uploadProcessor/uploadProcessorApp";
import splitProcessorRouter from "./src/api/splitProcessor/splitProcessorApp";
import imageDataTransferRouter from "./src/api/imageDataTransfer/imageDataTransferApp";
import s3ProcessorRouter from "./src/api/s3Processor/s3ProcessorApp";
import duplicateProcessorRouter from "./src/api/dataClean/dataCleanApp";
import cors from "cors";
import { startSshTunnel } from "./src/utils/tunnel";
import { connectMongo, disconnectMongo } from "./src/utils/dbConnect";
import { warmupPgPool } from "./src/utils/dbConnect";
import { verifyS3Connection } from "./src/api/s3Processor/s3Manager";

import { Server } from "net";

const app = express();
const port = process.env.NODE_ENV === "production" ? 3000 : 3000;

// [FIX] Sanitize the frontend URL to remove any trailing slashes
// This ensures "http://localhost:5173/" in .env becomes "http://localhost:5173"
// which matches the browser's Origin header exactly.
const rawFrontendUrl = process.env.API_FRONTEND_URL || "http://localhost:5173";
const frontendUrl = rawFrontendUrl.replace(/\/$/, "");

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  })
);
app.use(express.json());

app.get("/config", (req, res) => {
  res.json({
    apiBaseUrl: process.env.APP_BASE_URL,
    frontendUrl: frontendUrl,
  });
});

app.use(uploadProcessRouter);
app.use(splitProcessorRouter);
app.use(imageDataTransferRouter);
app.use(s3ProcessorRouter);
app.use(duplicateProcessorRouter);

const startServer = async () => {
  let pgServer: Server | undefined;

  if (process.env.USE_SSH_TUNNEL === "true") {
    pgServer = await startSshTunnel();
  }

  try {
    await connectMongo();
    console.log("MongoDB connection established.");
  } catch (error) {
    console.error("Failed to establish MongoDB connection:", error);
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

  // 1. Start the HTTP Server
  const expressServer = app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });

  // 2. Initialize WebSocket Server attached to the HTTP instance
  const wss = new WebSocketServer({ server: expressServer });

  // 3. Attach WSS to Express so Controllers can find it
  app.set("wss", wss);
  console.log("WebSocket Server initialized and attached to app.");

  // Connection logging
  wss.on("connection", (ws) => {
    console.log("[WS] Client connected.");
    ws.on("error", (err) => console.error("[WS] Error:", err));
  });

  const gracefulShutdown = () => {
    console.log("Shutting down gracefully...");
    expressServer.close(() => {
      console.log("Closed out remaining connections.");
      if (pgServer) {
        pgServer.close();
      }
      disconnectMongo();
      process.exit(0);
    });
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
};

startServer();
