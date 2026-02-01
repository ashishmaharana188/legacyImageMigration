import { Pool, PoolClient } from "pg";
import mongoose from "mongoose";
import logger from "./logger";
import { startMongoSshTunnel, startSshTunnel } from "./tunnel";
import { IAifDocument } from "../api/imageDataTransfer/imageDataTransferTypes";

// --- PostgreSQL Pool Configuration ---
let pgPool: Pool | null = null;

interface SshTunnelServer {
  close(): void;
}
let pgSshTunnel: SshTunnelServer | null = null;

const createPgPool = async (): Promise<Pool> => {
  const useSshTunnel = process.env.USE_SSH_TUNNEL === "true";
  let dbHost: string;
  let dbPort: number;

  if (useSshTunnel) {
    if (!pgSshTunnel) {
      logger.info({
        category: "app-flow",
        function: "createPgPool",
        message: "Attempting to start PostgreSQL SSH tunnel.",
      });
      try {
        const tunnel = await startSshTunnel();
        pgSshTunnel = tunnel as SshTunnelServer;
        logger.info({
          category: "app-flow",
          function: "createPgPool",
          message: "PostgreSQL SSH tunnel started successfully.",
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logger.error({
          category: "app-flow",
          function: "createPgPool",
          message: "Failed to start PostgreSQL SSH tunnel.",
          error: errorMessage,
        });
      }
    }
    dbHost = "localhost";
    dbPort = parseInt(process.env.DB_PORT || "5433", 10);
  } else {
    dbHost = "localhost";
    dbPort = parseInt(process.env.DB_PORT || "5432", 10);
  }

  const newPool = new Pool({
    user: useSshTunnel ? process.env.DB_USER : "postgres",
    host: dbHost,
    database: useSshTunnel ? process.env.DB_NAME : "test",
    password: useSshTunnel ? process.env.DB_PASSWORD : "123456",
    port: dbPort,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
  });

  newPool.on("connect", () => {
    logger.info({
      category: "app-flow",
      function: "createPgPool",
      message: "pg Pool: new backend connection established",
    });
  });
  newPool.on("error", (err) => {
    logger.error({
      category: "app-flow",
      function: "createPgPool",
      message: "pg Pool: unexpected error",
      error: err.message,
    });
    if (
      err.message.includes("ECONNREFUSED") ||
      err.message.includes("ETIMEDOUT")
    ) {
      reconnectPgPool().catch(() => {});
    }
  });

  logger.info({
    category: "app-flow",
    function: "createPgPool",
    message: `Postgres pool configured for ${dbHost}:${dbPort}`,
  });
  return newPool;
};

export const getPgPool = async (): Promise<Pool> => {
  if (!pgPool) pgPool = await createPgPool();
  return pgPool;
};

export const reconnectPgPool = async (): Promise<void> => {
  logger.warn({
    category: "app-flow",
    function: "reconnectPgPool",
    message: "Attempting to reconnect PostgreSQL pool.",
  });
  const MAX_RETRIES = 5;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      if (pgSshTunnel) {
        pgSshTunnel.close();
        pgSshTunnel = null;
      }
      if (pgPool) {
        await pgPool.end();
      }

      pgPool = await createPgPool();
      await warmupPgPool();
      return;
    } catch (e) {
      if (i === MAX_RETRIES - 1) throw e;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
};

export const warmupPgPool = async () => {
  const MAX_RETRIES = 5;
  let client: PoolClient | null = null;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      client = await (await getPgPool()).connect();
      await client.query("SELECT 1");
      logger.info({
        category: "app-flow",
        function: "warmupPgPool",
        message: "PostgreSQL warm-up successful",
      });
      return;
    } catch (err) {
      if (client) {
        client.release();
        client = null;
      }
      if (i === MAX_RETRIES - 1) throw new Error("PostgreSQL warm-up failed.");
      await new Promise((r) => setTimeout(r, 2000));
    } finally {
      if (client) client.release();
    }
  }
};

// --- MongoDB Connection Configuration ---
let mongoConnection: mongoose.Connection | null = null;
let mongoModel: mongoose.Model<IAifDocument> | null = null;

interface MongoSshTunnelServer {
  close(): void;
}
let mongoSshTunnel: MongoSshTunnelServer | null = null;

// [FIX] Changed Schema generic to IAifDocument to match Model type
const FnxTransactionInitiationDocUploadSchema =
  new mongoose.Schema<IAifDocument>(
    {
      activityStatus: String,
      applicationId: String,
      barcode: String,
      branchId: String,
      clientId: String,
      createdBy: String,
      createdFrom: String,
      createdOn: String,
      currentStage: Number,
      documentFormat: String,
      documentPath: String,
      documentSize: String,
      documentType: String,
      lastUpdatedBy: String,
      lastUpdatedFrom: String,
      lastUpdatedOn: String,
      mimeType: String,
      processCode: String,
      sourceUser: String,
      totalPageCount: Number,
      transactionCode: String,
      transactionNo: String,
      transactionType: String,
      workDate: String,
    },
    { collection: "fnxTransactionInitiationDocUpload", versionKey: false }
  );

const TestImageMigrationSchema = new mongoose.Schema(
  {},
  { strict: false, collection: "testImageMigration", versionKey: false }
);

export const getMongoModel = (): mongoose.Model<IAifDocument> => {
  if (!mongoModel) {
    const useTunnel = process.env.USE_MONGO_SSH_TUNNEL === "true";
    if (useTunnel) {
      // [FIX] Ensuring the cast is safe
      mongoModel =
        (mongoose.models
          .FnxTransactionInitiationDocUpload as mongoose.Model<IAifDocument>) ||
        mongoose.model<IAifDocument>(
          "FnxTransactionInitiationDocUpload",
          FnxTransactionInitiationDocUploadSchema
        );
    } else {
      mongoModel =
        (mongoose.models.TestImageMigration as mongoose.Model<IAifDocument>) ||
        (mongoose.model(
          "TestImageMigration",
          TestImageMigrationSchema
        ) as unknown as mongoose.Model<IAifDocument>);
    }
  }
  return mongoModel;
};

export const connectMongo = async (): Promise<void> => {
  if (mongoConnection && mongoConnection.readyState === 1) return;

  try {
    const useTunnel = process.env.USE_MONGO_SSH_TUNNEL === "true";
    let uri: string;

    if (useTunnel) {
      if (!mongoSshTunnel) {
        const tunnel = await startMongoSshTunnel();
        if (tunnel && tunnel.server)
          mongoSshTunnel = tunnel.server as MongoSshTunnelServer;
      }
      uri = process.env.MONGO_URI || "mongodb://localhost:27017/investor";
      const opts: mongoose.ConnectOptions = {};
      if (process.env.MONGO_USER && process.env.MONGO_PASSWORD) {
        opts.user = process.env.MONGO_USER;
        opts.pass = process.env.MONGO_PASSWORD;
        if (process.env.MONGO_AUTH_SOURCE)
          opts.authSource = process.env.MONGO_AUTH_SOURCE;
      }
      await mongoose.connect(uri, opts);
    } else {
      uri = process.env.LOCAL_URI || "";
      if (!uri) throw new Error("LOCAL_URI not set");
      await mongoose.connect(uri);
    }

    mongoConnection = mongoose.connection;
    logger.info({
      category: "app-flow",
      message: "MongoDB connected successfully",
    });
  } catch (error: any) {
    logger.error({
      category: "app-flow",
      message: `MongoDB connection error: ${error.message}`,
    });
    process.exit(1);
  }
};

export const disconnectMongo = async (): Promise<void> => {
  if (mongoConnection && mongoConnection.readyState === 1) {
    await mongoose.disconnect();
    mongoConnection = null;
    if (mongoSshTunnel) {
      mongoSshTunnel.close();
      mongoSshTunnel = null;
    }
  }
};

export const getMongoDb = () => {
  if (!mongoConnection || !mongoConnection.db)
    throw new Error("MongoDB connection not established");
  return mongoConnection.db;
};

export const disconnectPgPool = async (): Promise<void> => {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  if (pgSshTunnel) {
    pgSshTunnel.close();
    pgSshTunnel = null;
  }
};
