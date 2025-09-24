import React, { useState, useCallback, useEffect } from "react";
import axios from "axios";
import UploadAndScriptUI from "../ui/UploadAndScriptUI";

interface SummaryItem {
  fileName: string;
  status: string;
}

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
    successfulInserts: number;
    unsuccessfulCount: number;
    totalPageCount: number;
    totalSplitImages: number;
  };
  splitSummary?: {
    totalOriginalFilesProcessed: number;
    totalExpectedSplits: number;
    totalSplitFilesGenerated: number;
    splitErrors: number;
    totalExpectedPagesFromCsv: number;
  };
  downloadUrl?: string;
  fileUrls?: Array<{ row: number; url: string; pageCount: number }>;
  splitFiles?: SplitFile[];
  error?: string;
  directories?: string[];
  files?: any[]; // Replace 'any' with a specific type if you have one for S3 files
  badRowsFilePath?: string | null; // Added for bad rows file download
  updatedFolioRows?: number;
  updatedTransactionRows?: number;
  badRows?: number;
}

interface UploadStatus {
  fileName: string;
  progress?: number;
  status?: string;
}

interface UploadAndScriptTaskProps {
  updateTaskLog: (task: string, log: any) => void;
  setSummaryData: React.Dispatch<React.SetStateAction<SummaryItem[]>>;
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}

const UploadAndScriptTask: React.FC<UploadAndScriptTaskProps> = ({
  updateTaskLog,
  setSummaryData,
  setUploadStatuses,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string>("");
  const [splitMessage, setSplitMessage] = useState<string>("");
  const [splitFiles, setSplitFiles] = useState<SplitFile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [progressData, setProgressData] = useState<any>(null); // { totalRows, processedRows, successfulRows, errors, notFound }
  const [badRowsDetails, setBadRowsDetails] = useState<any[]>([]); // { rowNumber, id_acno, id_ihno, page_count_status }

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000"); // Connect to your WebSocket server

    ws.onopen = () => {
      console.log("WebSocket connection established");
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "progressUpdate") {
        setProgressData({
          totalRows: message.totalRows,
          processedRows: message.processedRows,
          successfulRows: message.successfulRows,
          errors: message.errors,
          notFound: message.notFound,
        });
        if (
          message.currentRow.page_count_status !== "Processing" &&
          typeof message.currentRow.page_count_status !== "number"
        ) {
          setBadRowsDetails((prev) => [...prev, message.currentRow]);
        }
      } else if (message.type === "progressComplete") {
        setProgressData({
          totalRows: message.totalRows,
          processedRows: message.processedRows,
          successfulRows: message.successfulRows,
          errors: message.errors,
          notFound: message.notFound,
        });
        console.log("Processing complete");
      }
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files[0]) {
        setSelectedFile(event.target.files[0]);
        setUploadMessage("");
        setSplitMessage("");
        setSplitFiles([]);
      }
    },
    []
  );

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      setUploadMessage("Please select a file first.");
      return;
    }

    setLoading(true);
    setUploadMessage("Uploading...");
    updateTaskLog("uploadAndScript", "Uploading...");
    const formData = new FormData();
    formData.append("excel", selectedFile);

    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/upload-excel",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-type",
          },
        }
      );
      setUploadMessage(res.data.message || "Upload successful");
      updateTaskLog("uploadAndScript", res.data);
    } catch (error: any) {
      const errorMessage = `Upload failed: ${
        error.response?.data?.message || error.message
      }`;
      setUploadMessage(errorMessage);
      updateTaskLog("uploadAndScript", { message: errorMessage });
    } finally {
      setLoading(false);
    }
  }, [selectedFile, updateTaskLog]);

  const handleSplitFiles = useCallback(async () => {
    if (!selectedFile) {
      setSplitMessage("Please upload a file first.");
      return;
    }

    setLoading(true);
    setSplitMessage("Splitting files...");
    updateTaskLog("uploadAndScript", "Splitting files...");
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/split-files",
        {
          filename: selectedFile.name,
        }
      );
      setSplitFiles(res.data.splitFiles || []);
      setSplitMessage(res.data.message || "Splitting successful");
      updateTaskLog("uploadAndScript", res.data);
    } catch (error: any) {
      const errorMessage = `Splitting failed: ${
        error.response?.data?.message || error.message
      }`;
      setSplitMessage(errorMessage);
      updateTaskLog("uploadAndScript", { message: errorMessage });
    } finally {
      setLoading(false);
    }
  }, [selectedFile, updateTaskLog]);

  const handleUploadToS3 = useCallback(async () => {
    setLoading(true);
    setUploadMessage("Uploading to S3...");
    setSummaryData([]); // Clear previous summary data
    setUploadStatuses([]); // Clear previous upload progress

    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/upload-to-s3"
      );
    } catch (error: any) {
      const errorMessage = `Upload to S3 failed: ${
        error.response?.data?.message || error.message
      }`;
      setUploadMessage(errorMessage);
      updateTaskLog("uploadAndScript", { message: errorMessage });
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog, setSummaryData, setUploadStatuses]);

  const handleUploadSplitFilesToS3 = useCallback(async () => {
    setLoading(true);
    setSplitMessage("Uploading split files to S3...");
    setUploadStatuses([]); // Clear previous upload progress
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/upload-split-to-s3",
        {}
      );
    } catch (error: any) {
      const errorMessage = `Upload of split files to S3 failed: ${
        error.response?.data?.message || error.message
      }`;
      setSplitMessage(errorMessage);
      updateTaskLog("uploadAndScript", { message: errorMessage });
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog, setUploadStatuses]);

  return (
    <UploadAndScriptUI
      selectedFile={selectedFile}
      uploadMessage={uploadMessage}
      splitMessage={splitMessage}
      splitFiles={splitFiles}
      loading={loading}
      handleFileChange={handleFileChange}
      handleUpload={handleUpload}
      handleSplitFiles={handleSplitFiles}
      handleUploadToS3={handleUploadToS3}
      handleUploadSplitFilesToS3={handleUploadSplitFilesToS3}
      progressData={progressData}
      badRowsDetails={badRowsDetails}
    />
  );
};

export default UploadAndScriptTask;
