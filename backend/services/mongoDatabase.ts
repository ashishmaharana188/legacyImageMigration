import mongoose from "mongoose";
import winston from "winston";
import { Database } from "./database";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

interface MongoDuplicateCheckResult {
  _id: { clientId: string; transactionNo: string };
  count: number;
  documentIds: mongoose.Types.ObjectId[];
  // Potentially add more fields if needed for dry-run details
}

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

  public getDb() {
    return mongoose.connection.db;
  }

  public async insertDocument(document: any): Promise<void> {
    try {
      const result = await this.model.insertMany(document, { ordered: false });
      const insertedInfo = document.map((doc: any) => ({
        transactionNo: doc.transactionNo,
        clientId: doc.clientId,
      }));
      logger.info({
        message: `${result.length} documents inserted successfully`,
        inserted: insertedInfo,
      });
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
      const db = this.getDb();
      if (!db) {
        logger.error("Database connection is not available.");
        return [];
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
    documents?: any[]; // Added to return the documents
  }> {
    try {
      const database = new Database();
      await this.connect();
      const db = this.getDb();
      if (!db) {
        logger.error("Database connection is not available.");
        return { transferredCount: 0 };
      }

      const transactionsMap: Record<string, string> = {
        IC: "ICP",
        NCT: "NCTP",
      };

      const pgData = await database.getAifDocumentDetails();
      const documentsToInsert = [];

      for (const data of pgData) {
        const docType = data.document_type;
        const docProcess = data.document_process;

        const doc = {
          activityStatus: data.activity_status || "O",
          applicationId: data.application_id || null,
          clientId: data.client_code, // Use the correct client_code
          createdBy: data.created_by || "system",
          createdFrom: new Date(data.creation_date)
            .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
            .toLocaleUpperCase(),
          createdOn: new Date(data.creation_date)
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
          transactionCode: data.document_process,
          transactionNo: data.transaction_reference_id,
          transactionType: docType.replace("Form", "").trim(),
          workDate: new Date()
            .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
            .toLocaleUpperCase(),
        };
        documentsToInsert.push(doc);
      }

      if (documentsToInsert.length > 0) {
        await this.insertDocument(documentsToInsert);
      }

      await this.disconnect();
      return { transferredCount: pgData.length, documents: documentsToInsert };
    } catch (error) {
      logger.error(`Data transfer error: ${error}`);
      throw error;
    }
  }

  public async updateMongoTransactions(): Promise<{
    updatedCount: number;
    syncedCount: number;
    updatedDocuments: any[];
    syncedDocuments: any[];
  }> {
    let updatedCount = 0;
    let syncedCount = 0;
    const updatedDocuments = [];
    const syncedDocuments = [];

    try {
      const database = new Database();
      await this.connect();
      const db = this.getDb();
      if (!db) {
        logger.error("Database connection is not available.");
        return {
          updatedCount: 0,
          syncedCount: 0,
          updatedDocuments: [],
          syncedDocuments: [],
        };
      }

      const pgData = await database.getUpdateDetails();

      for (const data of pgData) {
        const filter = {
          clientId: data.client_code,
          transactionNo: data.user_attr1,
        };

        const mongoDoc = await this.model.findOne(filter);

        if (mongoDoc) {
          if (mongoDoc.transactionNo !== data.transaction_reference_id) {
            await this.model.updateOne(filter, {
              $set: { transactionNo: data.transaction_reference_id },
            });
            updatedCount++;
            updatedDocuments.push({
              clientId: data.client_code,
              oldTransactionNo: mongoDoc.transactionNo,
              newTransactionNo: data.transaction_reference_id,
              documentType: mongoDoc.documentType,
              processCode: mongoDoc.processCode,
            });
          } else {
            syncedCount++;
            syncedDocuments.push({
              clientId: data.client_code,
              transactionNo: mongoDoc.transactionNo,
            });
          }
        }
      }

      await this.disconnect();
      return { updatedCount, syncedCount, updatedDocuments, syncedDocuments };
    } catch (error) {
      logger.error(`Mongo transaction update error: ${error}`);
      throw error;
    }
  }

  public async sanityCheckMongoDuplicates(params: {
    dryRun?: boolean;
  }): Promise<{
    result: "success" | "failed";
    dryRun: boolean;
    duplicates: MongoDuplicateCheckResult[];
    totalDuplicateGroups: number;
    totalDuplicateDocuments: number;
    logs: any[];
  }> {
    const logs: any[] = [];
    const { dryRun = true } = params;

    logger.info(`sanityCheckMongoDuplicates: Received dryRun: ${dryRun}`);

    try {
      await this.connect();

      const pipeline = [
        {
          $group: {
            _id: { clientId: "$clientId", transactionNo: "$transactionNo" },
            count: { $sum: 1 },
            documentIds: { $push: "$_id" },
            // Add other fields here if you want to see them in the dry run output
            // e.g., firstDocument: { $first: "$$ROOT" }
          },
        },
        {
          $match: {
            count: { $gt: 1 },
          },
        },
      ];

      const duplicates = await this.model.aggregate<MongoDuplicateCheckResult>(pipeline).exec();

      const totalDuplicateGroups = duplicates.length;
      const totalDuplicateDocuments = duplicates.reduce((sum, dup) => sum + dup.count, 0);

      logger.info(
        `sanityCheckMongoDuplicates: dry-run complete. Found ${totalDuplicateDocuments} duplicate documents across ${totalDuplicateGroups} groups.`
      );

      if (!dryRun) {
        // TODO: Implement actual deletion logic here if dryRun is false
        // This would involve iterating through 'duplicates' and deleting documents
        // based on your specific deletion rules (e.g., keep one, delete others).
        // For now, it just reports.
        logs.push({ status: "info", message: "Actual deletion logic not yet implemented." });
      }

      await this.disconnect();

      return {
        result: "success",
        dryRun,
        duplicates,
        totalDuplicateGroups,
        totalDuplicateDocuments,
        logs,
      };
    } catch (error) {
      logger.error(`sanityCheckMongoDuplicates failed: ${error}`);
      logs.push({ status: "error", message: `sanityCheckMongoDuplicates failed: ${error}` });
      return {
        result: "failed",
        dryRun,
        duplicates: [],
        totalDuplicateGroups: 0,
        totalDuplicateDocuments: 0,
        logs,
      };
    }
  }
}
