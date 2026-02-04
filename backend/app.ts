import dotenv from "dotenv";
import os from "os";
import path from "path";
import fs from "fs";
// [FIX] Remove local WebSocketServer import
// import { WebSocketServer } from "ws";

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
// [FIX] Import the initializer
import { initWebSocket } from "./src/utils/webSocketService";

import { Server } from "net";

const app = express();
const port = process.env.NODE_ENV === "production" ? 3000 : 3000;

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

<<<<<<< HEAD
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.get("/upload-progress", (req, res) => {
  res.json(uploadProgress);
});

app.post(
  "/upload-excel",
  upload.single("excel"),
  fileController.processExcelFile
);

app.post("/run-fallback", upload.single("excel"), fileController.runFallback);

app.get("/download/:filename", fileController.downloadFile);

app.get("/download-file/:filePath", fileController.downloadReferencedFile);
app.get(
  "/download-generated-file/:filename",
  fileController.downloadGeneratedFile
);

app.post("/split-files", fileController.splitFiles);
app.post("/split-mupdf", fileController.splitFilesWithMuPDF);
app.post("/upload-split-to-s3", fileController.uploadSplitFilesToS3);
app.post("/process-sql-mongo", fileController.processSqlMongo);

app.post("/sanity-check-duplicates", fileController.sanityCheckDuplicates);
app.post("/sanity-check-duplicate-mongo", fileController.checkMongoDuplicates);
app.post("/transfer-to-mongo", fileController.transferDataToMongo);
app.post("/update-mongo-transactions", fileController.updateMongoTransactions);
app.post("/upload-to-s3", fileController.uploadToS3);
app.get("/s3-list-objects", fileController.listS3Files);
app.post("/s3-delete-object", fileController.deleteS3Files);
app.get("/s3-search-files", fileController.searchS3Files);
app.get("/s3-search-folders", fileController.searchS3Folders);
app.post("/s3-generate-report", fileController.generateS3Report);
app.post("/reconnect", fileController.reconnect);
=======
app.use(uploadProcessRouter);
app.use(splitProcessorRouter);
app.use(imageDataTransferRouter);
app.use(s3ProcessorRouter);
app.use(duplicateProcessorRouter);
>>>>>>> switch-branch

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

  // 2. [FIX] Initialize the Singleton WebSocket Service
  // This sets the internal 'wss' variable so broadcast() works
  const wss = initWebSocket(expressServer);

  // 3. Attach WSS to Express (Preserving your existing architecture)
  app.set("wss", wss);
  console.log("WebSocket Server initialized and attached to app.");

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
