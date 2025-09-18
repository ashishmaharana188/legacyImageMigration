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
}

interface S3File {
  key: string;
  lastModified?: string;
}

interface SQLAndMongoTaskProps {
  updateTaskLog: (task: string, log: any) => void;
}

const SQLAndMongoTask: React.FC<SQLAndMongoTaskProps> = ({
  updateTaskLog,
}) => {
  const [loading, setLoading] = useState<boolean>(false);

  const handleUploadSplitFilesToS3 = useCallback(async () => {
    setLoading(true);
    updateTaskLog('sqlAndMongo', "Uploading split files to S3...");
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/upload-split-files-to-s3"
      );
      updateTaskLog('sqlAndMongo', res.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog('sqlAndMongo', error.response?.data || { message: "An unknown error occurred." });
      } else {
        updateTaskLog('sqlAndMongo', { message: "An unknown error occurred." });
      }
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog]);

  const handleUploadToS3 = useCallback(async () => {
    setLoading(true);
    updateTaskLog('sqlAndMongo', "Uploading processed file to S3...");
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/upload-to-s3"
      );
      updateTaskLog('sqlAndMongo', res.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog('sqlAndMongo', error.response?.data || { message: "An unknown error occurred." });
      } else {
        updateTaskLog('sqlAndMongo', { message: "An unknown error occurred." });
      }
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog]);

  const handleTransferToMongo = useCallback(async () => {
    setLoading(true);
    updateTaskLog('sqlAndMongo', "Transferring data to MongoDB...");
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/transfer-to-mongo"
      );
      updateTaskLog('sqlAndMongo', res.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog('sqlAndMongo', error.response?.data || { message: "An unknown error occurred." });
      } else {
        updateTaskLog('sqlAndMongo', { message: "An unknown error occurred." });
      }
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog]);

  const handleGenerateSql = useCallback(async () => {
    setLoading(true);
    updateTaskLog('sqlAndMongo', "Generating SQL...");
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/generate-sql"
      );
      updateTaskLog('sqlAndMongo', res.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog('sqlAndMongo', error.response?.data || { message: "An unknown error occurred." });
      } else {
        updateTaskLog('sqlAndMongo', { message: "An unknown error occurred." });
      }
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog]);

  const handleExecuteSql = useCallback(async () => {
    setLoading(true);
    updateTaskLog('sqlAndMongo', "Executing SQL...");
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/process-sql-mongo",
        { action: "executeSql" }
      );
      updateTaskLog('sqlAndMongo', res.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog('sqlAndMongo', error.response?.data || { message: "An unknown error occurred." });
      } else {
        updateTaskLog('sqlAndMongo', { message: "An unknown error occurred." });
      }
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog]);

  const handleupdateFolioAndTransaction = useCallback(async () => {
    setLoading(true);
    updateTaskLog('sqlAndMongo', "Updating folio and transaction...");
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/process-sql-mongo",
        { action: "updateFolioAndTransaction" }
      );
      updateTaskLog('sqlAndMongo', res.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog('sqlAndMongo', error.response?.data || { message: "An unknown error occurred." });
      } else {
        updateTaskLog('sqlAndMongo', { message: "An unknown error occurred." });
      }
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog]);

  return (
    <SQLAndMongoUI
      loading={loading}
      handleUploadSplitFilesToS3={handleUploadSplitFilesToS3}
      handleUploadToS3={handleUploadToS3}
      handleTransferToMongo={handleTransferToMongo}
      handleGenerateSql={handleGenerateSql}
      handleExecuteSql={handleExecuteSql}
      handleupdateFolioAndTransaction={handleupdateFolioAndTransaction}
    />
  );
};

export default SQLAndMongoTask;
