import mongoose from "mongoose";
import winston from "winston";
import { Database } from "./database";

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

export class MongoDatabase {
  private uri: string;
  private model: mongoose.Model<any>;

  constructor() {
    const useTunnel = process.env.USE_MONGO_SSH_TUNNEL === "true";

    if (useTunnel) {
      this.uri = process.env.MONGO_URI || "mongodb://localhost:27017/investor";
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
        { collection: "fnxTransactionInitiationDocUpload", versionKey: false }
      );

      this.model =
        mongoose.models.FnxTransactionInitiationDocUpload ||
        mongoose.model(
          "FnxTransactionInitiationDocUpload",
          FnxTransactionInitiationDocUploadSchema
        );
    } else {
      this.uri = process.env.LOCAL_URI || ""; // URI for test_noSql
      const TestImageMigrationSchema = new mongoose.Schema(
        {},
        { strict: false, collection: "testImageMigration", versionKey: false }
      );
      this.model =
        mongoose.models.TestImageMigration ||
        mongoose.model("TestImageMigration", TestImageMigrationSchema);
    }
  }

  public async connect(): Promise<void> {
    try {
      const useTunnel = process.env.USE_MONGO_SSH_TUNNEL === "true";

      if (useTunnel) {
        const connectOptions: mongoose.ConnectOptions = {};

        if (process.env.MONGO_USER && process.env.MONGO_PASSWORD) {
          connectOptions.user = process.env.MONGO_USER;
          connectOptions.pass = process.env.MONGO_PASSWORD;
          if (process.env.MONGO_AUTH_SOURCE) {
            connectOptions.authSource = process.env.MONGO_AUTH_SOURCE;
          }
        }
        await mongoose.connect(this.uri, connectOptions);
      } else {
        if (!this.uri) {
          logger.error("LOCAL_URI is not set for non-tunnel connection.");
          process.exit(1);
        }
        await mongoose.connect(this.uri);
      }
      logger.info("MongoDB connected successfully");

      // Check if the collection exists
      try {
        if (mongoose.connection.db) {
          const collectionName = this.model.collection.name;
          const collections = await mongoose.connection.db
            .listCollections({ name: collectionName })
            .toArray();

          if (collections.length === 0) {
            logger.error(
              `Collection '${collectionName}' does not exist. The application will exit.`
            );
            await mongoose.disconnect();
            process.exit(1);
          } else {
            const count = await mongoose.connection.db
              .collection(collectionName)
              .find()
              .sort({ _id: -1 })
              .toArray();
            logger.info(
              `MongoDB collection '${collectionName}' accessed successfully.`
            );
          }
        } else {
          logger.warn(
            "mongoose.connection.db is not available after connection."
          );
        }
      } catch (collectionError) {
        logger.warn(
          `Could not access '${this.model.collection.name}' collection: ${collectionError}`
        );
      }
    } catch (error) {
      logger.error(`MongoDB connection error: ${error}`);
      process.exit(1); // Exit process if MongoDB connection fails
    }
  }

  public async insertDocument(document: any): Promise<void> {
    try {
      await this.model.insertMany(document, { ordered: false });
      logger.info(`${document.length} documents inserted successfully`);
    } catch (error: any) {
      // If some failed, Mongoose will throw a BulkWriteError
      if (error.writeErrors) {
        for (const err of error.writeErrors) {
          const failedDoc = document[err.index];
          console.error(
            "Failed to insert transaction_reference_id:",
            failedDoc.transaction_reference_id
          );
        }
      } else {
        logger.error("Unexpected bulk insert error", error);
      }
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
      if (mongoose.connection.readyState !== 1) {
        logger.warn("MongoDB not connected. Attempting to connect...");
        await this.connect();
      }

      const result = await this.model.find({}).limit(1).lean();
      logger.info(
        `MongoDB connection test successful. Found ${result.length} document(s).`
      );
      return result;
    } catch (error) {
      logger.error(`MongoDB connection test failed: ${error}`);
      throw error;
    }
  }

  public async transferDataFromPostgres(): Promise<{
    transferredCount: number;
  }> {
    try {
      const database = new Database();
      await this.connect();

      const transactionsMap: Record<string, string> = {
        IC: "ICP",
        NCT: "NCTP",
      };

      const pgData = await database.getAifDocumentDetails();

      for (const data of pgData) {
        const docType = data.document_type;
        const docProcess = data.process_code;
        const doc = {
          activityStatus: data.activity_status || "O",
          applicationId: data.application_id || null,
          barcode: data.barcode || null,
          branchId: data.branch_id || "BR01",
          clientId: data.client_id,
          createdBy: data.created_by || "system",
          createdFrom: new Date(data.created_from)
            .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
            .toLocaleUpperCase(),
          createdOn: new Date(data.created_on)
            .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
            .toLocaleUpperCase(),
          currentStage: data.current_stage || 15,
          documentFormat: data.document_format,
          documentPath: data.document_path,
          documentSize: data.document_size || "",
          documentType: "APLCN",
          lastUpdatedBy: "",
          lastUpdatedFrom: data.last_updated_from || null,
          lastUpdatedOn: new Date()
            .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
            .toLocaleUpperCase(),
          mimeType: data.mime_type,
          processCode: transactionsMap[docProcess],
          sourceUser: data.source_user || "system",
          totalPageCount: data.total_page_count || null,
          transactionCode: data.transaction_code,
          transactionNo: data.transaction_reference_id,
          transactionType: docType.replace("Form", "").trim(),
          workDate: new Date()
            .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
            .toLocaleUpperCase(),
        };
        await this.insertDocument(doc);
      }

      await this.disconnect();
      return { transferredCount: pgData.length };
    } catch (error) {
      logger.error(`Data transfer error: ${error}`);
      throw error;
    }
  }
}
