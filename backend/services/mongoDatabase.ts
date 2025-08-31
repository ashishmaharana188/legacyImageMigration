import mongoose from "mongoose";
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
    new winston.transports.Console({
      level: "debug",
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Define the schema for fnxTransactionInitiationDocUpload
const FnxTransactionInitiationDocUploadSchema = new mongoose.Schema(
  {
    activityStatus: String,
    applicationId: String,
    barcode: String,
    branchId: String,
    clientId: Number,
    createdBy: String,
    createdFrom: Date,
    createdOn: Date,
    currentStage: Number,
    documentFormat: String,
    documentPath: String,
    documentSize: String,
    documentType: String,
    lastUpdatedBy: String,
    lastUpdatedFrom: String,
    lastUpdatedOn: Date,
    mimeType: String,
    processCode: String,
    sourceUser: String,
    totalPageCount: Number,
    transactionCode: String,
    transactionNo: String,
    transactionType: String,
    workDate: Date,
  },
  { collection: "fnxTransactionInitiationDocUpload" }
); // Specify collection name

// Create the model
const FnxTransactionInitiationDocUpload = mongoose.model(
  "FnxTransactionInitiationDocUpload",
  FnxTransactionInitiationDocUploadSchema
);

export class MongoDatabase {
  private uri: string;

  constructor() {
    this.uri = process.env.MONGO_URI || "mongodb://localhost:27017/investor"; // Default to 'investor' database
  }

  public async connect(): Promise<void> {
    try {
      const connectOptions: mongoose.ConnectOptions = {};

      if (process.env.MONGO_USER && process.env.MONGO_PASSWORD) {
        connectOptions.user = process.env.MONGO_USER;
        connectOptions.pass = process.env.MONGO_PASSWORD;
        if (process.env.MONGO_AUTH_SOURCE) {
          connectOptions.authSource = process.env.MONGO_AUTH_SOURCE;
        }
      }

      await mongoose.connect(this.uri, connectOptions);
      logger.info("MongoDB connected successfully");

      // Perform a simple check on the collection
      try {
        // Ensure db is available before accessing
        if (mongoose.connection.db) {
          const collection = mongoose.connection.db.collection(
            "fnxTransactionInitiationDocUpload"
          );
          const count = await collection.find().sort({ "_id:": -1 });
          logger.info(
            `MongoDB collection 'fnxTransactionInitiationDocUpload' accessed successfully. Contains ${count} documents.`
          );
        } else {
          logger.warn(
            "mongoose.connection.db is not available after connection."
          );
        }
      } catch (collectionError) {
        logger.warn(
          `Could not access 'fnxTransactionInitiationDocUpload' collection: ${collectionError}`
        );
      }
    } catch (error) {
      logger.error(`MongoDB connection error: ${error}`);
      process.exit(1); // Exit process if MongoDB connection fails
    }
  }

  public async insertDocument(document: any): Promise<void> {
    try {
      const newDoc = new FnxTransactionInitiationDocUpload(document);
      await newDoc.save();
      logger.info(
        `Document inserted into collection: fnxTransactionInitiationDocUpload`
      );
    } catch (error) {
      logger.error(`Error inserting document into MongoDB: ${error}`);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await mongoose.disconnect();
      logger.info("MongoDB disconnected");
    } catch (error) {
      logger.error(`Error disconnecting from MongoDB: ${error}`);
    }
  }

  public async testConnectionAndQuery(): Promise<any[]> {
    try {
      // Check if Mongoose is already connected
      if (mongoose.connection.readyState !== 1) {
        logger.warn("MongoDB not connected. Attempting to connect...");
        await this.connect(); // Attempt to connect if not already
      }

      // Perform a simple query to test the connection and collection access
      const result = await FnxTransactionInitiationDocUpload.find({})
        .limit(1)
        .lean();
      logger.info(
        "MongoDB connection test successful. Found 1 document (if any)."
      );
      return result;
    } catch (error) {
      logger.error(`MongoDB connection test failed: ${error}`);
      throw error;
    }
  }
}
