import React, { useState, useCallback, useEffect, useRef } from "react";
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

interface UploadStatus {
  fileName: string;
  progress?: number;
  status?: string;
  isDirectory?: boolean;
  totalFiles?: number;
  processedFiles?: number;
  successfulFiles?: number;
  errorFiles?: number;
  notFoundFiles?: number;
  badRowsDetails?: Array<{
    rowNumber: number;
    id_fund: string;
    id_trtype: string;
    id_ihno: string;
    id_path: string;
    id_acno: string;
    page_count_status: string | number;
  }>;
  totalOriginalFilesProcessed?: number;
  totalExpectedSplits?: number;
  totalSplitFilesGenerated?: number;
  splitErrors?: number;
  totalExpectedPagesFromCsv?: number;
  currentlySplittingFiles?: string;
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
  files?: any[];
  badRowsFilePath?: string | null;
  updatedFolioRows?: number;
  updatedTransactionRows?: number;
  badRows?: number;
}

interface UploadAndScriptTaskProps {
  updateTaskLog: (task: string, log: any) => void;
  clearTaskLog: (task: string) => void;
  setSummaryData: React.Dispatch<React.SetStateAction<SummaryItem[]>>;
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}

const UploadAndScriptTask: React.FC<UploadAndScriptTaskProps> = ({
  updateTaskLog,
  clearTaskLog,
  setSummaryData,
  setUploadStatuses,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string>("");
  const [splitMessage, setSplitMessage] = useState<string>("");
  const [splitFiles, setSplitFiles] = useState<SplitFile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:3000");

    ws.current.onopen = () => {
      console.log("WebSocket connection opened");
    };

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log("WebSocket message received:", message);

      if (message.type === "splitProgressUpdate") {
        setUploadStatuses((prevStatuses) => {
          const existingSplitStatusIndex = prevStatuses.findIndex(
            (s) => s.fileName === "splitting_progress"
          );

          const newSplitStatus: UploadStatus = {
            fileName: "splitting_progress",
            status: message.status || "In Progress",
            totalOriginalFilesProcessed: message.totalOriginalFilesProcessed,
            totalExpectedSplits: message.totalExpectedSplits,
            totalSplitFilesGenerated: message.totalSplitFilesGenerated,
            splitErrors: message.splitErrors,
            currentlySplittingFiles: message.currentlySplittingFiles,
          };

          if (
            newSplitStatus.totalExpectedSplits &&
            newSplitStatus.totalExpectedSplits > 0
          ) {
            newSplitStatus.progress =
              ((newSplitStatus.totalSplitFilesGenerated ?? 0) /
                newSplitStatus.totalExpectedSplits) *
              100;
          }

          if (existingSplitStatusIndex > -1) {
            const updatedStatuses = [...prevStatuses];
            updatedStatuses[existingSplitStatusIndex] = newSplitStatus;
            return updatedStatuses;
          } else {
            return [...prevStatuses, newSplitStatus];
          }
        });
        updateTaskLog("uploadAndScript", { splitSummary: message });
      } else if (message.type === "splitProgressComplete") {
        setUploadStatuses((prevStatuses) => {
          const existingSplitStatusIndex = prevStatuses.findIndex(
            (s) => s.fileName === "splitting_progress"
          );
          if (existingSplitStatusIndex > -1) {
            const updatedStatuses = [...prevStatuses];
            updatedStatuses[existingSplitStatusIndex] = {
              ...updatedStatuses[existingSplitStatusIndex],
              status: "Done",
              progress: 100,
              totalOriginalFilesProcessed: message.totalOriginalFilesProcessed,
              totalExpectedSplits: message.totalExpectedSplits,
              totalSplitFilesGenerated: message.totalSplitFilesGenerated,
              splitErrors: message.splitErrors,
              totalExpectedPagesFromCsv: message.totalExpectedPagesFromCsv,
            };
            return updatedStatuses;
          }
          return prevStatuses;
        });
        updateTaskLog("uploadAndScript", { splitSummary: message });
      }
    };

    ws.current.onclose = () => {
      console.log("WebSocket connection closed");
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      ws.current?.close();
    };
  }, [setUploadStatuses, updateTaskLog]);

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
    clearTaskLog("uploadAndScript");
    setLoading(true);
    setUploadMessage("Uploading");
    updateTaskLog("uploadAndScript", "Uploading");
    const formData = new FormData();
    formData.append("excel", selectedFile);

    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/upload-excel",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
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
  }, [selectedFile, updateTaskLog, clearTaskLog]);

  const handleSplitFiles = useCallback(async () => {
    if (!selectedFile) {
      setSplitMessage("Please upload a file first.");
      return;
    }
    clearTaskLog("uploadAndScript");
    setUploadStatuses([]); // Clear previous upload progress
    setLoading(true);
    setSplitMessage("Splitting files");
    updateTaskLog("uploadAndScript", "Splitting files");

    // Initialize splitting progress status
    setUploadStatuses((prevStatuses) => {
      const splittingStatus: UploadStatus = {
        fileName: "splitting_progress",
        status: "Starting",
        totalOriginalFilesProcessed: 0,
        totalExpectedSplits: 0,
        totalSplitFilesGenerated: 0,
        splitErrors: 0,
        currentlySplittingFiles: "",
        progress: 0,
      };
      return [...prevStatuses, splittingStatus];
    });

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
      setUploadStatuses((prevStatuses) =>
        prevStatuses.map((s) =>
          s.fileName === "splitting_progress"
            ? { ...s, status: "Failed", progress: 0 }
            : s
        )
      );
    } finally {
      setLoading(false);
    }
  }, [selectedFile, updateTaskLog, clearTaskLog, setUploadStatuses]);

  const handleUploadToS3 = useCallback(async () => {
    clearTaskLog("uploadAndScript");
    setLoading(true);
    setUploadMessage("Uploading to S3");
    updateTaskLog("uploadAndScript", "Initiating S3 upload...");
    setSummaryData([]); // Clear previous summary data
    setUploadStatuses([{"fileName": "Data/APPLICATION_FORMS", "status": "Starting", "isDirectory": true, "progress": 0}]); // Initialize with a starting status

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
  }, [updateTaskLog, clearTaskLog, setSummaryData, setUploadStatuses]);

  const handleUploadSplitFilesToS3 = useCallback(async () => {
    clearTaskLog("uploadAndScript");
    setLoading(true);
    setSplitMessage("Uploading split files to S3");
    updateTaskLog("uploadAndScript", "Initiating split file S3 upload...");
    setUploadStatuses([{"fileName": "Data/SPLIT_APPLICATION_FORMS", "status": "Starting", "isDirectory": true, "progress": 0}]); // Initialize with a starting status
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
  }, [updateTaskLog, clearTaskLog, setUploadStatuses]);

  const handleFallback = useCallback(async () => {
    if (!selectedFile) {
      setUploadMessage("Please select a file first.");
      return;
    }
    clearTaskLog("uploadAndScript");
    setLoading(true);
    setUploadMessage("Running fallback...");
    updateTaskLog("uploadAndScript", "Running fallback...");
    const formData = new FormData();
    formData.append("excel", selectedFile);

    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/run-fallback",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      setUploadMessage(res.data.message || "Fallback successful");
      updateTaskLog("uploadAndScript", res.data);
    } catch (error: any) {
      const errorMessage = `Fallback failed: ${
        error.response?.data?.message || error.message
      }`;
      setUploadMessage(errorMessage);
      updateTaskLog("uploadAndScript", { message: errorMessage });
    } finally {
      setLoading(false);
    }
  }, [selectedFile, updateTaskLog, clearTaskLog]);

  const handleSplitFilesWithMuPDF = useCallback(async () => {
    if (!selectedFile) {
      setSplitMessage("Please upload a file first.");
      return;
    }
    clearTaskLog("uploadAndScript");
    setUploadStatuses([]); // Clear previous upload progress
    setLoading(true);
    setSplitMessage("Splitting files with MuPDF");
    updateTaskLog("uploadAndScript", "Splitting files with MuPDF");

    // Initialize splitting progress status
    setUploadStatuses((prevStatuses) => {
      const splittingStatus: UploadStatus = {
        fileName: "splitting_progress",
        status: "Starting",
        totalOriginalFilesProcessed: 0,
        totalSplitFilesGenerated: 0,
        splitErrors: 0,
        currentlySplittingFiles: "",
        progress: 0,
      };
      return [...prevStatuses, splittingStatus];
    });

    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/split-mupdf"
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
      setUploadStatuses((prevStatuses) =>
        prevStatuses.map((s) =>
          s.fileName === "splitting_progress"
            ? { ...s, status: "Failed", progress: 0 }
            : s
        )
      );
    } finally {
      setLoading(false);
    }
  }, [selectedFile, updateTaskLog, clearTaskLog, setUploadStatuses]);

  return (
    <UploadAndScriptUI
      selectedFile={selectedFile}
      uploadMessage={uploadMessage}
      splitMessage={splitMessage}
      splitFiles={splitFiles}
      loading={loading}
      handleFileChange={handleFileChange}
      handleUpload={handleUpload}
      handleFallback={handleFallback}
      handleSplitFiles={handleSplitFiles}
      handleSplitFilesWithMuPDF={handleSplitFilesWithMuPDF}
      handleUploadToS3={handleUploadToS3}
      handleUploadSplitFilesToS3={handleUploadSplitFilesToS3}
    />
  );
};

export default UploadAndScriptTask;
