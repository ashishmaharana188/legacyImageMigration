import React, { useState, useCallback, useEffect, useRef } from "react";
import axios from "axios";
import UploadAndScriptUI from "../ui/UploadAndScriptUI";
import { webSocketService } from "../../services/webSocketService";

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
  setSummaryData: React.Dispatch<React.SetStateAction<{ [key: string]: any[] }>>;
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

  // Refs for throttling
  const splitProgressLatestRef = useRef<any | null>(null);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const THROTTLE_INTERVAL = 200; // Update UI every 200ms

  const applyThrottledUpdates = useCallback(() => {
    // Apply latest split progress
    const latestSplitMessage = splitProgressLatestRef.current;
    if (latestSplitMessage) {
      setUploadStatuses((prev) => {
        const newStatuses = prev.filter(
          (s) => s.fileName !== "splitting_progress"
        );
        const isComplete = latestSplitMessage.type === "splitProgressComplete";
        const progress = isComplete
          ? 100
          : latestSplitMessage.totalExpectedSplits > 0
          ? (latestSplitMessage.totalSplitFilesGenerated /
              latestSplitMessage.totalExpectedSplits) *
            100
          : 0;

        newStatuses.push({
          fileName: "splitting_progress",
          status: isComplete
            ? "Done"
            : latestSplitMessage.status || "In Progress",
          progress: progress,
          ...latestSplitMessage,
        });
        return newStatuses;
      });
      updateTaskLog("uploadAndScript", { splitSummary: latestSplitMessage });
      splitProgressLatestRef.current = null;
    }

    throttleTimerRef.current = null;
  }, [setUploadStatuses, updateTaskLog]);

  useEffect(() => {
    const handleMessage = (message: any) => {
      let needsUpdate = false;

      if (message.type === "s3-upload-total-directories") {
        setUploadStatuses((prevStatuses) => {
          const otherStatuses = prevStatuses.filter(
            (s) => s.fileName !== "s3_upload_progress"
          );
          return [
            ...otherStatuses,
            {
              fileName: "s3_upload_progress",
              status: "Starting upload",
              progress: 0,
              totalFiles: message.totalDirectories,
              processedFiles: 0,
            },
          ];
        });
      } else if (message.type === "s3-directory-progress") {
        setUploadStatuses((prevStatuses) => {
          const otherStatuses = prevStatuses.filter(
            (s) => s.fileName !== "s3_upload_progress"
          );
          const progress = message.totalDirectories > 0 ? (message.completedDirectories / message.totalDirectories) * 100 : 0;
          return [
            ...otherStatuses,
            {
              fileName: "s3_upload_progress",
              status:
                message.completedDirectories === message.totalDirectories ? "Done" : `Uploading ${message.currentDirectory}...`,
              progress: progress,
              totalFiles: message.totalDirectories,
              processedFiles: message.completedDirectories,
            },
          ];
        });
      } else if (
        message.type === "splitProgressUpdate" ||
        message.type === "splitProgressComplete"
      ) {
        splitProgressLatestRef.current = message;
        needsUpdate = true;
      }

      if (needsUpdate && !throttleTimerRef.current) {
        throttleTimerRef.current = setTimeout(
          applyThrottledUpdates,
          THROTTLE_INTERVAL
        );
      }
    };

    webSocketService.addListener(handleMessage);

    return () => {
      webSocketService.removeListener(handleMessage);
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, [applyThrottledUpdates, setUploadStatuses]);

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
    setUploadStatuses([
      { fileName: "s3_upload_progress", status: "Starting", progress: 0, totalFiles: 1, processedFiles: 0 },
    ]);

    try {
      await axios.post<FileResponse>("http://localhost:3000/upload-to-s3");
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
    setUploadStatuses([
      { fileName: "s3_upload_progress", status: "Starting", progress: 0, totalFiles: 1, processedFiles: 0 },
    ]);
    try {
      await axios.post<FileResponse>(
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
