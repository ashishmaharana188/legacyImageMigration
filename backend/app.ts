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
import { startSshTunnel } from "./services/tunnel";
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

app.post("/upload-to-s3", fileController.uploadToS3);

// WebSocket server setup
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws: WebSocket) => {
  console.log("WebSocket client connected");
  ws.send(JSON.stringify({ type: "message", payload: "Welcome to the WebSocket server!" }));
});

export { wss }; // Export wss for use in other modules

const startServer = async () => {
  let server: any;
  if (process.env.USE_SSH_TUNNEL === "true") {
    server = await startSshTunnel();
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
      if (server) {
        server.close();
        console.log("SSH tunnel closed.");
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