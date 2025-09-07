import React, { useState, useCallback } from "react";
import axios, { AxiosError } from "axios";
import SQLAndMongoUI from "../ui/SQLAndMongoUI";

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
  splitFiles?: string[];
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
}

const SQLAndMongoTask: React.FC<SQLAndMongoTaskProps> = ({
  setResponse,
  setLogs,
  setUpdateFolioResult,
}) => {
  const [loading, setLoading] = useState<boolean>(false);

  const handleUploadSplitFilesToS3 = useCallback(async () => {
    setLogs({ status: "Uploading split files to S3...", errors: [] });
    setLoading(true);
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3001/upload-split-to-s3"
      );
      setResponse(res.data);
      setLogs((prev) => ({
        ...prev,
        status: res.data.message || "Upload to S3 successful!",
      }));
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setLogs((prev) => ({
          ...prev,
          status: "Upload to S3 failed.",
          errors: [
            ...prev.errors,
            error.response?.data?.error || "An unknown error occurred.",
          ],
        }));
        setResponse(error.response?.data || null);
      } else {
        setLogs((prev) => ({
          ...prev,
          status: "Upload to S3 failed.",
          errors: [...prev.errors, "An unknown error occurred."],
        }));
        setResponse(null);
      }
    } finally {
      setLoading(false);
    }
  }, [setLogs, setResponse]);

  const handleUploadToS3 = useCallback(async () => {
    setLogs({ status: "Uploading processed file to S3...", errors: [] });
    setLoading(true);
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3001/upload-processed-to-s3"
      );
      setResponse(res.data);
      setLogs((prev) => ({
        ...prev,
        status: res.data.message || "Upload to S3 successful!",
      }));
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setLogs((prev) => ({
          ...prev,
          status: "Upload to S3 failed.",
          errors: [
            ...prev.errors,
            error.response?.data?.error || "An unknown error occurred.",
          ],
        }));
        setResponse(error.response?.data || null);
      } else {
        setLogs((prev) => ({
          ...prev,
          status: "Upload to S3 failed.",
          errors: [...prev.errors, "An unknown error occurred."],
        }));
        setResponse(null);
      }
    } finally {
      setLoading(false);
    }
  }, [setLogs, setResponse]);

  const handleTransferToMongo = useCallback(async () => {
    setLogs({ status: "Transferring data to MongoDB...", errors: [] });
    setLoading(true);
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3001/transfer-to-mongo"
      );
      setResponse(res.data);
      setLogs((prev) => ({
        ...prev,
        status: res.data.message || "Transfer to MongoDB successful!",
      }));
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setLogs((prev) => ({
          ...prev,
          status: "Transfer to MongoDB failed.",
          errors: [
            ...prev.errors,
            error.response?.data?.error || "An unknown error occurred.",
          ],
        }));
        setResponse(error.response?.data || null);
      } else {
        setLogs((prev) => ({
          ...prev,
          status: "Transfer to MongoDB failed.",
          errors: [...prev.errors, "An unknown error occurred."],
        }));
        setResponse(null);
      }
    } finally {
      setLoading(false);
    }
  }, [setLogs, setResponse]);

  const handleGenerateSql = useCallback(async () => {
    setLogs({ status: "Generating SQL...", errors: [] });
    setLoading(true);
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3001/generate-sql"
      );
      setResponse(res.data);
      setLogs((prev) => ({
        ...prev,
        status: res.data.message || "SQL generation successful!",
      }));
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setLogs((prev) => ({
          ...prev,
          status: "SQL generation failed.",
          errors: [
            ...prev.errors,
            error.response?.data?.error || "An unknown error occurred.",
          ],
        }));
        setResponse(error.response?.data || null);
      } else {
        setLogs((prev) => ({
          ...prev,
          status: "SQL generation failed.",
          errors: [...prev.errors, "An unknown error occurred."],
        }));
        setResponse(null);
      }
    } finally {
      setLoading(false);
    }
  }, [setLogs, setResponse]);

  const handleExecuteSql = useCallback(async () => {
    setLogs({ status: "Executing SQL...", errors: [] });
    setLoading(true);
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3001/execute-sql"
      );
      setResponse(res.data);
      setLogs((prev) => ({
        ...prev,
        status: res.data.message || "SQL execution successful!",
      }));
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setLogs((prev) => ({
          ...prev,
          status: "SQL execution failed.",
          errors: [
            ...prev.errors,
            error.response?.data?.error || "An unknown error occurred.",
          ],
        }));
        setResponse(error.response?.data || null);
      } else {
        setLogs((prev) => ({
          ...prev,
          status: "SQL execution failed.",
          errors: [...prev.errors, "An unknown error occurred."],
        }));
        setResponse(null);
      }
    } finally {
      setLoading(false);
    }
  }, [setLogs, setResponse]);

  const handleupdateFolioAndTransaction = useCallback(async () => {
    setLogs({ status: "Updating folio and transaction...", errors: [] });
    setLoading(true);
    try {
      const res = await axios.post(
        "http://localhost:3001/update-folio-and-transaction"
      );
      setUpdateFolioResult(res.data);
      setLogs((prev) => ({
        ...prev,
        status: res.data.message || "Folio and transaction update successful!",
      }));
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setLogs((prev) => ({
          ...prev,
          status: "Folio and transaction update failed.",
          errors: [
            ...prev.errors,
            error.response?.data?.error || "An unknown error occurred.",
          ],
        }));
        setUpdateFolioResult(error.response?.data || null);
      } else {
        setLogs((prev) => ({
          ...prev,
          status: "Folio and transaction update failed.",
          errors: [...prev.errors, "An unknown error occurred."],
        }));
        setUpdateFolioResult(null);
      }
    } finally {
      setLoading(false);
    }
  }, [setLogs, setUpdateFolioResult]);

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
