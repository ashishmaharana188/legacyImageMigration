import dotenv from "dotenv";
import os from "os";
import path from "path";

import * as fs from "fs";

const isProduction = process.env.NODE_ENV === "production";
const envFile = isProduction ? ".env.production" : ".env.development";
const userConfigDir = path.join(os.homedir(), ".appConfig");
const envPath = path.join(userConfigDir, envFile);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`USE_MONGO_SSH_TUNNEL: ${process.env.USE_MONGO_SSH_TUNNEL}`);
  console.log(`MONGO_URI: ${process.env.MONGO_URI}`);
  console.log(`LOCAL_URI: ${process.env.LOCAL_URI}`);

  if (isProduction) {
    console.log("Connected to Prod database");
  } else {
    console.log("Connected to Dev database");
  }
} else {
  console.warn(`Warning: Environment file not found at: ${envPath}`);
}

import express from "express";
import cors from "cors";
import multer from "multer";
import * as fsp from "fs/promises";
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

app.post(
  "/upload-excel",
  upload.single("excel"),
  fileController.processExcelFile
);

app.get("/download/:filename", fileController.downloadFile);

app.get("/download-file/:filePath", fileController.downloadReferencedFile);

app.post("/split-files", fileController.splitFiles);
app.post("/upload-split-files-to-s3", fileController.uploadSplitFilesToS3);
app.post("/generate-sql", fileController.generateSql);
app.post("/execute-sql", fileController.executeSql);
app.post(
  "/updateFolioAndTransaction-sql",
  fileController.updateFolioAndTransaction
);

app.post("/sanity-check-duplicates", fileController.sanityCheckDuplicates);
app.post("/transfer-to-mongo", fileController.transferDataToMongo);
app.post("/upload-to-s3", fileController.uploadToS3);
app.get("/api/s3/list", fileController.listS3Files);

// WebSocket server setup
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws: WebSocket) => {
  console.log("WebSocket client connected");
  ws.send(
    JSON.stringify({
      type: "message",
      payload: "Welcome to the WebSocket server!",
    })
  );
});

export { wss };

const startServer = async () => {
  let pgServer: any;
  let mongoServer: any;
  let mongoLocalPort: number | undefined;

  if (process.env.USE_SSH_TUNNEL === "true") {
    pgServer = await startSshTunnel();
  }

  if (process.env.USE_MONGO_SSH_TUNNEL === "true") {
    const tunnelResult = await startMongoSshTunnel();
    if (tunnelResult) {
      mongoServer = tunnelResult.server;
      mongoLocalPort = tunnelResult.localPort;

      if (process.env.MONGO_URI) {
        try {
          const mongoUriObj = new URL(process.env.MONGO_URI);
          mongoUriObj.hostname = "localhost";
          mongoUriObj.port = mongoLocalPort.toString();
          process.env.MONGO_URI = mongoUriObj.toString();
          console.log(
            `MongoDB URI updated for tunnel: ${process.env.MONGO_URI}`
          );
        } catch (e) {
          console.error("Error parsing MONGO_URI for tunnel update:", e);
        }
      } else {
        console.warn("USE_MONGO_SSH_TUNNEL is true but MONGO_URI is not set.");
      }
    }
  }

  const mongoDatabase = new MongoDatabase();
  try {
    await mongoDatabase.connect();
    console.log("MongoDB connection established during startup.");
  } catch (error) {
    console.error(
      "Failed to establish MongoDB connection during startup:",
      error
    );
  }

  const expressServer = app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });

  expressServer.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  const gracefulShutdown = () => {
    console.log("Shutting down gracefully...");
    expressServer.close(() => {
      console.log("Closed out remaining connections.");
      if (pgServer) {
        pgServer.close();
        console.log("PostgreSQL SSH tunnel closed.");
      }
      if (mongoServer) {
        mongoServer.close();
        console.log("MongoDB SSH tunnel closed.");
      }
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
