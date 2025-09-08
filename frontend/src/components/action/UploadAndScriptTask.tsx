
import React, { useState, useCallback } from 'react';
import axios from 'axios';
import UploadAndScriptUI from '../ui/UploadAndScriptUI';

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
}

interface UploadAndScriptTaskProps {
  setResponse: React.Dispatch<React.SetStateAction<FileResponse | null>>;
}

const UploadAndScriptTask: React.FC<UploadAndScriptTaskProps> = ({ setResponse }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [splitMessage, setSplitMessage] = useState<string>('');
  const [splitFiles, setSplitFiles] = useState<SplitFile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setUploadMessage('');
      setSplitMessage('');
      setSplitFiles([]);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      setUploadMessage("Please select a file first.");
      return;
    }

    setLoading(true);
    setUploadMessage("Uploading...");
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
      setUploadMessage(res.data.message || 'Upload successful');
      setResponse(res.data);
    } catch (error: any) {
      setUploadMessage(
        `Upload failed: ${error.response?.data?.message || error.message}`
      );
    } finally {
      setLoading(false);
    }
  }, [selectedFile, setResponse]);

  const handleSplitFiles = useCallback(async () => {
    if (!selectedFile) {
      setSplitMessage("Please upload a file first.");
      return;
    }

    setLoading(true);
    setSplitMessage("Splitting files...");
    try {
      const res = await axios.post<FileResponse>("http://localhost:3000/split-files", {
        filename: selectedFile.name,
      });
      setSplitFiles(res.data.splitFiles || []);
      setSplitMessage(res.data.message || 'Splitting successful');
      setResponse(res.data);
    } catch (error: any) {
      setSplitMessage(
        `Splitting failed: ${error.response?.data?.message || error.message}`
      );
    } finally {
      setLoading(false);
    }
  }, [selectedFile, setResponse]);

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
    />
  );
};

export default UploadAndScriptTask;
