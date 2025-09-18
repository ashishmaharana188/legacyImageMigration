import React, { useState, useCallback } from "react";
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

interface UploadAndScriptTaskProps {
  updateTaskLog: (task: string, log: any) => void;
  setSummaryData: React.Dispatch<React.SetStateAction<SummaryItem[]>>;
  setUploadProgress: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

const UploadAndScriptTask: React.FC<UploadAndScriptTaskProps> = ({
  updateTaskLog,
  setSummaryData,
  setUploadProgress,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string>("");
  const [splitMessage, setSplitMessage] = useState<string>("");
  const [splitFiles, setSplitFiles] = useState<SplitFile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

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
    if (!selectedFile) {
      setUploadMessage("Please select a file first.");
      return;
    }

    setLoading(true);
    setUploadMessage("Uploading to S3...");
    updateTaskLog("uploadAndScript", "Uploading to S3...");
    setSummaryData([]); // Clear previous summary data
    setUploadProgress({}); // Clear previous upload progress
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/upload-to-s3",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress({ [selectedFile.name]: percentCompleted });
              setUploadMessage(`Uploading to S3: ${percentCompleted}%`);
            }
          },
        }
      );
      setUploadMessage(res.data.message || "Upload to S3 successful");
      updateTaskLog("uploadAndScript", res.data);
      setSummaryData([{ fileName: selectedFile.name, status: res.data.message || "Upload successful" }]);
    } catch (error: any) {
      const errorMessage = `Upload to S3 failed: ${
        error.response?.data?.message || error.message
      }`;
      setUploadMessage(errorMessage);
      updateTaskLog("uploadAndScript", { message: errorMessage });
    } finally {
      setLoading(false);
    }
  }, [selectedFile, updateTaskLog]);

  const handleUploadSplitFilesToS3 = useCallback(async () => {
    setLoading(true);
    setSplitMessage("Uploading split files to S3...");
    updateTaskLog("uploadAndScript", "Uploading split files to S3...");
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/upload-split-to-s3",
        {}
      );
      setSplitMessage(
        res.data.message || "Upload of split files to S3 successful"
      );
      updateTaskLog("uploadAndScript", res.data);
    } catch (error: any) {
      const errorMessage = `Upload of split files to S3 failed: ${
        error.response?.data?.message || error.message
      }`;
      setSplitMessage(errorMessage);
      updateTaskLog("uploadAndScript", { message: errorMessage });
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog]);

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
    />
  );
};

export default UploadAndScriptTask;