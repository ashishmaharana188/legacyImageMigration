import dotenv from "dotenv";
import os from "os";
import path from "path"; // path is needed for dotenv config

// Ensure dotenv is configured as early as possible
const userConfigDir = path.join(os.homedir(), ".appConfig");
dotenv.config({ path: path.join(userConfigDir, ".env") });

import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs/promises";
import { fileController } from "./controllers/fileController";
import { startSshTunnel, startMongoSshTunnel } from "./services/tunnel";
import { MongoDatabase } from "./services/mongoDatabase"; // Added this line
import { WebSocketServer } from "ws"; // Added this line

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uploadDir = "uploads";
const processedDir = "processed";

async function ensureDirectories() {
  try {
    if (
      !(await fs
        .access(uploadDir)
        .then(() => true)
        .catch(() => false))
    ) {
      await fs.mkdir(uploadDir, { recursive: true });
      console.log(`Created directory: ${uploadDir}`);
    }
    if (
      !(await fs
        .access(processedDir)
        .then(() => true)
        .catch(() => false))
    ) {
      await fs.mkdir(processedDir, { recursive: true });
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

app.post(
  "/upload-excel",
  upload.single("excel"),
  fileController.processExcelFile
);

app.get("/download/:filename", fileController.downloadFile);

app.get("/download-file/:filePath", fileController.downloadReferencedFile);

app.post("/split-files", fileController.splitFiles);
app.post("/generate-sql", fileController.generateSql);
app.post("/execute-sql", fileController.executeSql);
app.post(
  "/updateFolioAndTransaction-sql",
  fileController.updateFolioAndTransaction
);

app.post("/sanity-check-duplicates", fileController.sanityCheckDuplicates);
app.post("/transfer-to-mongo", fileController.transferDataToMongo);
app.post("/upload-to-s3", fileController.uploadToS3);

// WebSocket server setup
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws: WebSocket) => {
  console.log("WebSocket client connected");
  ws.send(JSON.stringify({ type: "message", payload: "Welcome to the WebSocket server!" }));
});

export { wss }; // Export wss for use in other modules

const startServer = async () => {
  let pgServer: any; // For PostgreSQL tunnel
  let mongoServer: any; // For MongoDB tunnel
  let mongoLocalPort: number | undefined;

  if (process.env.USE_SSH_TUNNEL === "true") {
    pgServer = await startSshTunnel(); // Start PostgreSQL tunnel
  }

  if (process.env.USE_MONGO_SSH_TUNNEL === "true") {
    const tunnelResult = await startMongoSshTunnel();
    if (tunnelResult) {
      mongoServer = tunnelResult.server;
      mongoLocalPort = tunnelResult.localPort;

      // Parse the original MONGO_URI and update its host/port for the tunnel
      if (process.env.MONGO_URI) {
        try {
          const mongoUriObj = new URL(process.env.MONGO_URI);
          mongoUriObj.hostname = 'localhost';
          mongoUriObj.port = mongoLocalPort.toString();
          process.env.MONGO_URI = mongoUriObj.toString();
          console.log(`MongoDB URI updated for tunnel: ${process.env.MONGO_URI}`);
        } catch (e) {
          console.error("Error parsing MONGO_URI for tunnel update:", e);
          // Fallback to original URI or handle error
        }
      } else {
        console.warn("USE_MONGO_SSH_TUNNEL is true but MONGO_URI is not set.");
      }
    }
  }

  // Initialize and connect to MongoDB during server startup
  const mongoDatabase = new MongoDatabase();
  try {
    await mongoDatabase.connect();
    console.log("MongoDB connection established during startup.");
  } catch (error) {
    console.error("Failed to establish MongoDB connection during startup:", error);
  }

  const expressServer = app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });

  // Upgrade HTTP server to WebSocket
  expressServer.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  const gracefulShutdown = () => {
    console.log("Shutting down gracefully...");
    expressServer.close(() => {
      console.log("Closed out remaining connections.");
      if (pgServer) { // Changed from 'server' to 'pgServer'
        pgServer.close(); // Changed from 'server' to 'pgServer'
        console.log("PostgreSQL SSH tunnel closed."); // Clarified message
      }
      if (mongoServer) { // Added for MongoDB tunnel
        mongoServer.close();
        console.log("MongoDB SSH tunnel closed."); // Added message
      }
      // Close WebSocket server
      wss.close(() => {
        console.log("WebSocket server closed.");
      });
      process.exit(0);
    });
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
};

startServer();