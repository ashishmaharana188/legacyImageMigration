
import React, { useState, useCallback } from 'react';
import axios from 'axios';
import UploadAndScriptUI from '../ui/UploadAndScriptUI';

interface UploadAndScriptTaskProps {
  // Define any props that might be passed down from App.tsx
}

const UploadAndScriptTask: React.FC<UploadAndScriptTaskProps> = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [splitMessage, setSplitMessage] = useState<string>('');
  const [splitFiles, setSplitFiles] = useState<string[]>([]);
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
      const response = await axios.post(
        "http://localhost:3000/upload-excel",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      setUploadMessage(response.data.message);
    } catch (error: any) {
      setUploadMessage(
        `Upload failed: ${error.response?.data?.message || error.message}`
      );
    } finally {
      setLoading(false);
    }
  }, [selectedFile]);

  const handleSplitFiles = useCallback(async () => {
    if (!selectedFile) {
      setSplitMessage("Please upload a file first.");
      return;
    }

    setLoading(true);
    setSplitMessage("Splitting files...");
    try {
      const response = await axios.post("http://localhost:3000/split-files", {
        filename: selectedFile.name,
      });
      setSplitFiles(response.data.splitFiles);
      setSplitMessage(response.data.message);
    } catch (error: any) {
      setSplitMessage(
        `Splitting failed: ${error.response?.data?.message || error.message}`
      );
    } finally {
      setLoading(false);
    }
  }, [selectedFile]);

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
