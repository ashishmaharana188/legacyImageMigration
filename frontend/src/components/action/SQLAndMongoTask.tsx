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
  successfulRows?: string;
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
  const [clientCode, setClientCode] = useState<string>("");

  const handleTransferToMongo = useCallback(
    async (updateAll: boolean, clientCode: string) => {
      setLoading(true);
      clearTaskLog("sqlAndMongo");
      const taskMessage = updateAll
        ? "Updating Mongo transactions"
        : "Transferring data to MongoDB";
      updateTaskLog("sqlAndMongo", taskMessage);

      try {
        const url = updateAll
          ? "http://localhost:3000/process-sql-mongo/sql/update-mongo-transactions"
          : "http://localhost:3000/process-sql-mongo/sql/transfer-to-mongo";
        const res = await axios.post<FileResponse>(url, { clientCode });
        updateTaskLog("sqlAndMongo", res.data);
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          updateTaskLog(
            "sqlAndMongo",
            error.response?.data || { message: "An unknown error occurred." }
          );
        } else {
          updateTaskLog("sqlAndMongo", {
            message: "An unknown error occurred.",
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [updateTaskLog, clearTaskLog]
  );

  const handleExecuteSql = useCallback(async () => {
    setLoading(true);
    clearTaskLog("sqlAndMongo");
    updateTaskLog("sqlAndMongo", "Executing SQL");
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/process-sql-mongo/sql/executeSql",
        { action: "executeSql" }
      );
      const {
        totalRows = 0,
        successfulRows = 0,
        badRows = 0,
        message: resMessage,
        ...restData
      } = res.data;

      let finalMessage = resMessage || "SQL execution completed.";
      let finalStatus: "success" | "failed" = "success";

      if (badRows > 0) {
        finalMessage = `SQL execution completed: ${successfulRows} Successful, ${badRows} Failed out of ${totalRows} rows.`;
        finalStatus = "failed";
      } else if (totalRows > 0) {
        finalMessage = `SQL executed successfully. Total rows: ${totalRows}, Successful: ${successfulRows}.`;
        finalStatus = "success";
      } else {
        finalMessage = resMessage || "No rows processed during SQL execution.";
        finalStatus = "success";
      }

      updateTaskLog("sqlAndMongo", {
        message: finalMessage,
        status: finalStatus,
        totalRows: totalRows,
        successfulRows: successfulRows,
        badRows: badRows,
        ...restData,
      });
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

  const handleupdateFolioAndTransaction = useCallback(
    async (updateAll: boolean) => {
      setLoading(true);
      clearTaskLog("sqlAndMongo");
      updateTaskLog("sqlAndMongo", "Updating folio and transaction");
      try {
        const res = await axios.post<FileResponse>(
          "http://localhost:3000/process-sql-mongo/sql/update-folio-transaction",
          { action: "updateFolioAndTransaction", updateAll }
        );
        const {
          updatedFolioRows = 0,
          updatedTransactionRows = 0,
          badRows = 0,
          message: resMessage,
          ...restData
        } = res.data;

        let finalMessage =
          resMessage || "Folio and Transaction update completed.";
        let finalStatus: "success" | "failed" = "success";

        if (badRows > 0) {
          finalMessage = `Folio and Transaction update completed: Folio Rows Updated: ${updatedFolioRows}, Transaction Rows Updated: ${updatedTransactionRows}, Bad Rows: ${badRows}.`;
          finalStatus = "failed";
        } else if (updatedFolioRows > 0 || updatedTransactionRows > 0) {
          finalMessage = `Folio and Transaction updated successfully. Folio Rows: ${updatedFolioRows}, Transaction Rows: ${updatedTransactionRows}.`;
          finalStatus = "success";
        } else {
          finalMessage = resMessage || "No Folio or Transaction rows updated.";
          finalStatus = "success";
        }

        updateTaskLog("sqlAndMongo", {
          message: finalMessage,
          status: finalStatus,
          updatedFolioRows: updatedFolioRows,
          updatedTransactionRows: updatedTransactionRows,
          badRows: badRows,
          ...restData,
        });
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          updateTaskLog(
            "sqlAndMongo",
            error.response?.data || { message: "An unknown error occurred." }
          );
        } else {
          updateTaskLog("sqlAndMongo", {
            message: "An unknown error occurred.",
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [updateTaskLog, clearTaskLog]
  );

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
      handleExecuteSql={handleExecuteSql}
      handleupdateFolioAndTransaction={handleupdateFolioAndTransaction}
      handleReconnect={handleReconnect}
      clientCode={clientCode}
      setClientCode={setClientCode}
    />
  );
};

export default SQLAndMongoTask;
