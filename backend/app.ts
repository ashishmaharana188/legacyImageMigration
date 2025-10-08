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
import cors from "cors";
import multer from "multer";
import * as fsp from "fs/promises";
import { fileController } from "./controllers/fileController";
import { startSshTunnel } from "./services/tunnel";
import { initWebSocket } from "./services/webSocketService";
import { verifyS3Connection } from "./services/s3Manager";
import { connectMongo, disconnectMongo, warmupPgPool } from "./controllers/dbConnect";

// Global object to store upload progress
export const uploadProgress = {
  totalRows: 0,
  processedRows: 0,
  successfulRows: 0,
  errors: 0,
  notFound: 0,
};

// Graceful shutdown and error handling
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

const app = express();
const port = process.env.NODE_ENV === 'production' ? 3000 : 3001;

app.use(cors());
app.use(express.json());

const uploadDir = "uploads";
const processedDir = "processed";

async function ensureDirectories() {
  try {
    if (
      !(await fsp
        .access(uploadDir)
        .then(() => true)
        .catch(() => false))
    ) {
      await fsp.mkdir(uploadDir, { recursive: true });
      console.log(`Created directory: ${uploadDir}`);
    }
    if (
      !(await fsp
        .access(processedDir)
        .then(() => true)
        .catch(() => false))
    ) {
      await fsp.mkdir(processedDir, { recursive: true });
      console.log(`Created directory: ${processedDir}`);
    }
  } catch (err) {
    console.error("Failed to create directories:", err);
    process.exit(1);
  }
}

ensureDirectories();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.originalname.endsWith(".xlsx")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only .xlsx files are allowed"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.get("/", (req, res) => {
  res.json({
    message: "PDF Processor Backend is running!",
    timestamp: new Date().toISOString(),
  });
});

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
app.post("/reconnect", fileController.reconnect);

const startServer = async () => {
  let pgServer: any;

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

  await warmupPgPool();

  await verifyS3Connection();

  const expressServer = app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log("Express server listening, initializing WebSocket server...");
  });

  initWebSocket(expressServer);

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