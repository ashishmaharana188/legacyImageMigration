import React, { useState, useCallback } from "react";
import axios, { AxiosError } from "axios";
import SQLAndMongoUI from "../ui/SQLAndMongoUI";

interface SplitFile {
  originalPath: string;
  url: string;
  page: number;
}

interface FileResponse {
  statusCode?: number;
  message?: string;
  originalFile?: string;
  processedFile?: string;
  nextContinuationToken?: string;
  summary?: {
    totalRows: number;
    successfulRows: number;
    errors: number;
    notFound: number;
    successfulInserts: number; // Added from pdfProcessor.ts
    unsuccessfulCount: number; // Added from pdfProcessor.ts (bad rows)
    totalPageCount: number; // Added from pdfProcessor.ts
    totalSplitImages: number; // Added from pdfProcessor.ts
    badRowsFilePath?: string | null; // Added for bad rows file download
  };
  splitSummary?: {
    totalOriginalFilesProcessed: number;
    totalExpectedSplits: number; // Re-added: Internal count of expected splits
    totalSplitFilesGenerated: number;
    splitErrors: number;
    totalExpectedPagesFromCsv: number; // Added from splitProcessor.ts
  };
  downloadUrl?: string;
  fileUrls?: Array<{ row: number; url: string; pageCount: number }>;
  splitFiles?: SplitFile[];
  error?: string;
  directories?: string[];
  files?: S3File[];
  badRowsFilePath?: string | null; // Added for bad rows file download
  updatedFolioRows?: number;
  updatedTransactionRows?: number;
  badRows?: number;
  transferredCount?: number; // Added for transfer to mongo
  documents?: any[]; // Added for transfer to mongo to hold document details
  rows?: any[]; // Added for sanityCheckDuplicates dry-run results
}

interface S3File {
  key: string;
  lastModified?: string;
}

interface SQLAndMongoTaskProps {
  updateTaskLog: (task: string, log: any) => void;
  clearTaskLog: (task: string) => void;
}

const SQLAndMongoTask: React.FC<SQLAndMongoTaskProps> = ({
  updateTaskLog,
  clearTaskLog,
}) => {
  const [loading, setLoading] = useState<boolean>(false);

  const handleTransferToMongo = useCallback(async (updateAll: boolean) => {
    setLoading(true);
    clearTaskLog("sqlAndMongo");
    const taskMessage = updateAll ? "Updating Mongo transactions" : "Transferring data to MongoDB";
    updateTaskLog("sqlAndMongo", taskMessage);
    
    try {
      const url = updateAll 
        ? "http://localhost:3000/update-mongo-transactions" 
        : "http://localhost:3000/transfer-to-mongo";
      const res = await axios.post<FileResponse>(url);
      updateTaskLog("sqlAndMongo", res.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog(
          "sqlAndMongo",
          error.response?.data || { message: "An unknown error occurred." }
        );
      } else {
        updateTaskLog("sqlAndMongo", { message: "An unknown error occurred." });
      }
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog, clearTaskLog]);

  const handleGenerateSql = useCallback(async () => {
    setLoading(true);
    clearTaskLog("sqlAndMongo");
    updateTaskLog("sqlAndMongo", "Generating SQL");
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/generate-sql"
      );
      updateTaskLog("sqlAndMongo", res.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog(
          "sqlAndMongo",
          error.response?.data || { message: "An unknown error occurred." }
        );
      } else {
        updateTaskLog("sqlAndMongo", { message: "An unknown error occurred." });
      }
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog, clearTaskLog]);

  const handleExecuteSql = useCallback(async () => {
    setLoading(true);
    clearTaskLog("sqlAndMongo");
    updateTaskLog("sqlAndMongo", "Executing SQL");
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/process-sql-mongo",
        { action: "executeSql" }
      );
      updateTaskLog("sqlAndMongo", res.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog(
          "sqlAndMongo",
          error.response?.data || { message: "An unknown error occurred." }
        );
      } else {
        updateTaskLog("sqlAndMongo", { message: "An unknown error occurred." });
      }
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog, clearTaskLog]);

  const handleupdateFolioAndTransaction = useCallback(async (updateAll: boolean) => {
    setLoading(true);
    clearTaskLog("sqlAndMongo");
    updateTaskLog("sqlAndMongo", "Updating folio and transaction");
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/process-sql-mongo",
        { action: "updateFolioAndTransaction", updateAll }
      );
      updateTaskLog("sqlAndMongo", res.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog(
          "sqlAndMongo",
          error.response?.data || { message: "An unknown error occurred." }
        );
      } else {
        updateTaskLog("sqlAndMongo", { message: "An unknown error occurred." });
      }
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog, clearTaskLog]);

  const handleReconnect = useCallback(async () => {
    setLoading(true);
    clearTaskLog("sqlAndMongo");
    updateTaskLog("sqlAndMongo", "Reconnecting to the database");
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/reconnect"
      );
      updateTaskLog("sqlAndMongo", res.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog(
          "sqlAndMongo",
          error.response?.data || { message: "An unknown error occurred." }
        );
      } else {
        updateTaskLog("sqlAndMongo", { message: "An unknown error occurred." });
      }
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog, clearTaskLog]);

  return (
    <SQLAndMongoUI
      loading={loading}
      handleTransferToMongo={handleTransferToMongo}
      handleGenerateSql={handleGenerateSql}
      handleExecuteSql={handleExecuteSql}
      handleupdateFolioAndTransaction={handleupdateFolioAndTransaction}
      handleReconnect={handleReconnect}
    />
  );
};

export default SQLAndMongoTask;
