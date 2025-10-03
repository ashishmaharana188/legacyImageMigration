import { Pool, PoolClient } from "pg";
import mongoose from "mongoose";
import logger from "../utils/logger"; // Centralized logger
import { startMongoSshTunnel } from "../services/tunnel"; // Import the tunnel starter

// --- PostgreSQL Pool Configuration ---
let pgPool: Pool | null = null;

const createPgPool = (): Pool => {
  const useSshTunnel = process.env.USE_SSH_TUNNEL === "true";
  const newPool = new Pool({
    user: useSshTunnel ? process.env.DB_USER : "postgres",
    host: useSshTunnel ? process.env.DB_HOST : "localhost",
    database: useSshTunnel ? process.env.DB_NAME : "test",
    password: useSshTunnel ? process.env.DB_PASSWORD : "123456",
    port: useSshTunnel
      ? parseInt(process.env.DB_PORT || "5433", 10)
      : parseInt(process.env.DB_PORT || "5432", 10),
    max: 20,
    idleTimeoutMillis: 30000, // 30 seconds
    connectionTimeoutMillis: 10000,
    keepAlive: true,
  });

  newPool.on("connect", () => {
    logger.info({ category: 'app-flow', function: "createPgPool", message: "pg Pool: new backend connection established", });
  });
  newPool.on("acquire", () => {
    logger.info({ category: 'app-flow', function: "createPgPool", message: "pg Pool: client checked out from pool", });
  });

  newPool.on("error", (err) => {
    logger.error({ category: 'app-flow', function: "createPgPool", message: "pg Pool: unexpected error on idle client", error: err.message, });
    if (
      err.message.includes("ECONNREFUSED") ||
      err.message.includes("ETIMEDOUT") ||
      err.message.includes("ENOTFOUND") ||
      err.message.includes("EHOSTUNREACH")
    ) {
      logger.error({ category: 'app-flow', function: "createPgPool", message: "pg Pool: Critical connection error detected. Attempting to reconnect pool.", error: err.message, });
      reconnectPgPool().catch((reconnectErr) => {
        logger.error({ category: 'app-flow', function: "createPgPool", message: "Failed to re-establish PostgreSQL pool after critical error.", error: reconnectErr.message, });
      });
    }
  });

  logger.info({ category: 'app-flow', function: "createPgPool", message: "Postgres pool created", });
  const poolConfig = {
    user: useSshTunnel ? process.env.DB_USER : "postgres",
    host: useSshTunnel ? process.env.DB_HOST : "localhost",
    database: useSshTunnel ? process.env.DB_NAME : "test",
    port: useSshTunnel
      ? parseInt(process.env.DB_PORT || "5433", 10)
      : parseInt(process.env.DB_PORT || "5432", 10),
  };
  logger.info({ category: 'app-flow', function: "createPgPool", message: `Postgres pool configured for ${poolConfig.host}:${poolConfig.port}`, });
  return newPool;
};

export const getPgPool = (): Pool => {
  if (!pgPool) {
    pgPool = createPgPool();
  }
  return pgPool;
};

export const reconnectPgPool = async (): Promise<void> => {
  logger.warn({ category: 'app-flow', function: "reconnectPgPool", message: "Attempting to reconnect PostgreSQL pool.", });
  const MAX_RECONNECT_RETRIES = 5;
  const RECONNECT_DELAY_MS = 5000; // 5 seconds

  for (let i = 0; i < MAX_RECONNECT_RETRIES; i++) {
    try {
      if (pgPool) {
        await pgPool.end();
        logger.info({ category: 'app-flow', function: "reconnectPgPool", message: "Existing PostgreSQL pool ended.", });
      }
      pgPool = createPgPool();
      await warmupPgPool(); // Warm up the new pool
      logger.info({ category: 'app-flow', function: "reconnectPgPool", message: "PostgreSQL pool reconnected successfully.", });
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      logger.error({ category: 'app-flow', function: "reconnectPgPool", message: `PostgreSQL pool reconnection failed (attempt ${i + 1}/${MAX_RECONNECT_RETRIES})`, error: msg, });
      if (i < MAX_RECONNECT_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
      }
      else {
        logger.error({ category: 'app-flow', function: "reconnectPgPool", message: "Failed to reconnect PostgreSQL pool after multiple attempts.", error: msg, });
        throw e; // Re-throw after all retries fail
      }
    }
  }
};

export const warmupPgPool = async () => {
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 2000; // 2 seconds
  let client: PoolClient | null = null;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      logger.info({ category: 'app-flow', function: "warmupPgPool", message: `Attempting PostgreSQL database warm-up (attempt ${i + 1}/${MAX_RETRIES})...`, });
      client = await getPgPool().connect();
      const onClientError = (e: Error) =>
        logger.error({ category: 'app-flow', function: "warmupPgPool", message: "warmup client error", error: e.message, });
      client.on("error", onClientError);
      await client.query("SELECT 1");
      client.off("error", onClientError);
      logger.info({ category: 'app-flow', function: "warmupPgPool", message: "PostgreSQL database connection warm-up successful", });
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logger.warn({ category: 'app-flow', function: "warmupPgPool", message: `PostgreSQL database warm-up failed (attempt ${i + 1}/${MAX_RETRIES})`, error: msg, originalError: err, });
      if (client) {
        client.release();
        client = null;
      }
      if (i < MAX_RETRIES - 1) {
        logger.info({ category: 'app-flow', function: "warmupPgPool", message: `Retrying in ${RETRY_DELAY_MS / 1000} seconds...`, });
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    } finally {
      if (client) client.release();
    }
  }
  logger.error({ category: 'app-flow', function: "warmupPgPool", message: `PostgreSQL database warm-up failed after ${MAX_RETRIES} attempts.`, });
  throw new Error("PostgreSQL database warm-up failed.");
};

// --- MongoDB Connection Configuration ---
let mongoConnection: mongoose.Connection | null = null;
let mongoModel: mongoose.Model<any> | null = null;

const FnxTransactionInitiationDocUploadSchema = new mongoose.Schema(
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

export const getMongoModel = (): mongoose.Model<any> => {
  if (!mongoModel) {
    const useTunnel = process.env.USE_MONGO_SSH_TUNNEL === "true";
    if (useTunnel) {
      mongoModel =
        mongoose.models.FnxTransactionInitiationDocUpload ||
        mongoose.model(
          "FnxTransactionInitiationDocUpload",
          FnxTransactionInitiationDocUploadSchema
        );
    } else {
      mongoModel =
        mongoose.models.TestImageMigration ||
        mongoose.model("TestImageMigration", TestImageMigrationSchema);
    }
  }
  return mongoModel;
};

export const connectMongo = async (): Promise<void> => {
  if (mongoConnection && mongoConnection.readyState === 1) {
    logger.info({ category: 'app-flow', message: "MongoDB already connected." });
    return;
  }

  try {
    const useTunnel = process.env.USE_MONGO_SSH_TUNNEL === "true";
    let uri: string;

    if (useTunnel) {
      console.log("Attempting to start MongoDB SSH tunnel.");
      await startMongoSshTunnel(); // Start the SSH tunnel
      uri = process.env.MONGO_URI || "mongodb://localhost:27017/investor";
      const connectOptions: mongoose.ConnectOptions = {};
      if (process.env.MONGO_USER && process.env.MONGO_PASSWORD) {
        connectOptions.user = process.env.MONGO_USER;
        connectOptions.pass = process.env.MONGO_PASSWORD;
        if (process.env.MONGO_AUTH_SOURCE) {
          connectOptions.authSource = process.env.MONGO_AUTH_SOURCE;
        }
      }
      await mongoose.connect(uri, connectOptions);
    } else {
      uri = process.env.LOCAL_URI || "";
      if (!uri) {
        logger.error({ category: 'app-flow', message: "LOCAL_URI is not set for non-tunnel MongoDB connection." });
        process.exit(1);
      }
      await mongoose.connect(uri);
    }

    mongoConnection = mongoose.connection;
    logger.info({ category: 'app-flow', message: "MongoDB connected successfully" });

    // Check if the collection exists
    if (mongoose.connection && mongoose.connection.db) {
      try {
        const collectionName = getMongoModel().collection.name;
        const collections = await mongoose.connection.db
          .listCollections({ name: collectionName })
          .toArray();

        if (collections.length === 0) {
          logger.error({ category: 'app-flow', message: `Collection '${collectionName}' does not exist. The application will exit.` });
          await mongoose.disconnect();
          process.exit(1);
        } else {
          logger.info({ category: 'app-flow', message: `MongoDB collection '${collectionName}' accessed successfully.` });
        }
      } catch (collectionError) {
        logger.warn({ category: 'app-flow', message: `Could not access '${getMongoModel().collection.name}' collection: ${collectionError}` });
      }
    } else {
      logger.error({ category: 'app-flow', message: "MongoDB connection or db object is not available after connection attempt." });
      process.exit(1);
    }
  } catch (error) {
    logger.error({ category: 'app-flow', message: `MongoDB connection error: ${error}` });
    process.exit(1);
  }
};

export const disconnectMongo = async (): Promise<void> => {
  if (mongoConnection && mongoConnection.readyState === 1) {
    try {
      await mongoose.disconnect();
      mongoConnection = null;
      logger.info({ category: 'app-flow', message: "MongoDB disconnected" });
    } catch (error) {
      logger.error({ category: 'app-flow', message: `Error disconnecting from MongoDB: ${error}` });
    }
  } else {
    logger.info({ category: 'app-flow', message: "MongoDB not connected, no need to disconnect." });
  }
};

export const getMongoDb = () => {
  if (!mongoConnection || mongoConnection.readyState !== 1) {
    logger.error({ category: 'app-flow', message: "MongoDB connection is not established." });
    throw new Error("MongoDB connection is not established.");
  }
  if (!mongoConnection.db) {
    logger.error({ category: 'app-flow', message: "MongoDB database object is not available." });
    throw new Error("MongoDB database object is not available.");
  }
  return mongoConnection.db;
};
