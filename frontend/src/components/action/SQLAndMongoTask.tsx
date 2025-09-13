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
}

interface S3File {
  key: string;
  lastModified?: string;
}

interface SQLAndMongoTaskProps {
  setResponse: React.Dispatch<React.SetStateAction<FileResponse | null>>;
  setLogs: React.Dispatch<
    React.SetStateAction<{ status: string; errors: string[] }>
  >;
  setUpdateFolioResult: React.Dispatch<React.SetStateAction<unknown>>;
  updateTaskLog: (task: string, log: any) => void;
}

const SQLAndMongoTask: React.FC<SQLAndMongoTaskProps> = ({
  setResponse,
  setLogs,
  setUpdateFolioResult,
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
      setResponse(res.data);
      updateTaskLog('sqlAndMongo', res.data.message || "Upload to S3 successful!");
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog('sqlAndMongo', `Upload to S3 failed: ${error.response?.data?.error || "An unknown error occurred."}`);
        setResponse(error.response?.data || null);
      } else {
        updateTaskLog('sqlAndMongo', "Upload to S3 failed: An unknown error occurred.");
        setResponse(null);
      }
    } finally {
      setLoading(false);
    }
  }, [setResponse, updateTaskLog]);

  const handleUploadToS3 = useCallback(async () => {
    setLoading(true);
    updateTaskLog('sqlAndMongo', "Uploading processed file to S3...");
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/upload-to-s3"
      );
      setResponse(res.data);
      updateTaskLog('sqlAndMongo', res.data.message || "Upload to S3 successful!");
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog('sqlAndMongo', `Upload to S3 failed: ${error.response?.data?.error || "An unknown error occurred."}`);
        setResponse(error.response?.data || null);
      } else {
        updateTaskLog('sqlAndMongo', "Upload to S3 failed: An unknown error occurred.");
        setResponse(null);
      }
    } finally {
      setLoading(false);
    }
  }, [setResponse, updateTaskLog]);

  const handleTransferToMongo = useCallback(async () => {
    setLoading(true);
    updateTaskLog('sqlAndMongo', "Transferring data to MongoDB...");
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/transfer-to-mongo"
      );
      setResponse(res.data);
      updateTaskLog('sqlAndMongo', res.data.message || "Transfer to MongoDB successful!");
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog('sqlAndMongo', `Transfer to MongoDB failed: ${error.response?.data?.error || "An unknown error occurred."}`);
        setResponse(error.response?.data || null);
      } else {
        updateTaskLog('sqlAndMongo', "Transfer to MongoDB failed: An unknown error occurred.");
        setResponse(null);
      }
    } finally {
      setLoading(false);
    }
  }, [setResponse, updateTaskLog]);

  const handleGenerateSql = useCallback(async () => {
    setLoading(true);
    updateTaskLog('sqlAndMongo', "Generating SQL...");
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/generate-sql"
      );
      setResponse(res.data);
      updateTaskLog('sqlAndMongo', res.data.message || "SQL generation successful!");
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog('sqlAndMongo', `SQL generation failed: ${error.response?.data?.error || "An unknown error occurred."}`);
        setResponse(error.response?.data || null);
      } else {
        updateTaskLog('sqlAndMongo', "SQL generation failed: An unknown error occurred.");
        setResponse(null);
      }
    } finally {
      setLoading(false);
    }
  }, [setResponse, updateTaskLog]);

  const handleExecuteSql = useCallback(async () => {
    setLoading(true);
    updateTaskLog('sqlAndMongo', "Executing SQL...");
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/execute-sql"
      );
      setResponse(res.data);
      updateTaskLog('sqlAndMongo', res.data.message || "SQL execution successful!");
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog('sqlAndMongo', `SQL execution failed: ${error.response?.data?.error || "An unknown error occurred."}`);
        setResponse(error.response?.data || null);
      } else {
        updateTaskLog('sqlAndMongo', "SQL execution failed: An unknown error occurred.");
        setResponse(null);
      }
    } finally {
      setLoading(false);
    }
  }, [setResponse, updateTaskLog]);

  const handleupdateFolioAndTransaction = useCallback(async () => {
    setLoading(true);
    updateTaskLog('sqlAndMongo', "Updating folio and transaction...");
    try {
      const res = await axios.post(
        "http://localhost:3000/updateFolioAndTransaction-sql"
      );
      setUpdateFolioResult(res.data);
      updateTaskLog('sqlAndMongo', res.data.message || "Folio and transaction update successful!");
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog('sqlAndMongo', `Folio and transaction update failed: ${error.response?.data?.error || "An unknown error occurred."}`);
        setUpdateFolioResult(error.response?.data || null);
      } else {
        updateTaskLog('sqlAndMongo', "Folio and transaction update failed: An unknown error occurred.");
        setUpdateFolioResult(null);
      }
    } finally {
      setLoading(false);
    }
  }, [setUpdateFolioResult, updateTaskLog]);

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
