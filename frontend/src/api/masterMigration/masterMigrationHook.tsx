import React, { useState } from "react";
import MasterMigrationUI from "../masterMigration/masterMigrationUI";
import { UseMasterMigrationHookProps } from "../masterMigration/masterMigrationType";

async function uploadFile<T>(endpoint: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "File upload failed");
  }

  return response.json();
}

export const useMasterMigrationHook = ({
  updateTaskLog,
  clearTaskLog,
}: UseMasterMigrationHookProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
      setUploadStatus("");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus("Please select a file first.");
      return;
    }

    setUploadStatus("Uploading and checking file integrity...");

    const formData = new FormData();
    formData.append("masterFile", selectedFile);

    try {
      const result = await uploadFile<{ status: string; message?: string }>(
        "/api/check-file-integrity", // Adjusted API endpoint
        selectedFile,
      );
      setUploadStatus(
        `File integrity check: ${result.status}. ${result.message || ""}`,
      );
    } catch (error: any) {
      console.error("Error uploading file:", error);
      setUploadStatus(
        `Error: ${error.message || "Error uploading file. Please try again."}`,
      );
    }
  };

  return (
    <MasterMigrationUI
      selectedFile={selectedFile}
      uploadStatus={uploadStatus}
      handleFileChange={handleFileChange}
      handleUpload={handleUpload}
    />
  );
};
