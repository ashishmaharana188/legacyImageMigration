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
import uploadProcessRouter from "./src/api/uploadProcessor/UploadProcessApp";
import splitProcessorRouter from "./src/api/splitProcessor/splitProcessorApp";
import cors from "cors";
import { startSshTunnel } from "./services/tunnel";
import { connectMongo, disconnectMongo } from "./controllers/dbConnect"
import { warmupPgPool } from "./controllers/dbConnect";
import { verifyS3Connection } from "./services/s3Manager";
import { initWebSocket } from "./services/webSocketService";

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
    apiBaseUrl: process.env.APP_BACKEND_URL,
    frontendUrl: process.env.API_FRONTEND_URL,
  });
});

app.use(uploadProcessRouter);
app.use(splitProcessorRouter);

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
