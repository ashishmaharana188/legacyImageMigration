import { useState } from "react";
import { UseMasterMigrationHookProps } from "./masterMigrationType";
import { checkFileIntegrity } from "./masterMigrationService";

export const useMasterMigrationHook = ({
  updateTaskLog,
  clearTaskLog,
}: UseMasterMigrationHookProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];

      setSelectedFile(file);
      setUploadStatus("");

      console.log("Selected file:", file.name);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus("Please select a file first.");
      return;
    }

    setUploadStatus("Uploading and checking file integrity...");

    try {
      const result = await checkFileIntegrity(selectedFile);

      setUploadStatus(
        `File integrity check: ${result.status}. ${result.message ?? ""}`,
      );

      updateTaskLog?.(`File integrity check completed: ${result.status}`);
    } catch (error: any) {
      console.error("Error uploading file:", error);

      setUploadStatus(
        `Error: ${
          error.response?.data?.message ??
          error.message ??
          "File upload failed."
        }`,
      );

      updateTaskLog?.(
        `File integrity check failed: ${
          error.response?.data?.message ?? error.message
        }`,
      );
    }
  };

  return {
    selectedFile,
    uploadStatus,
    handleFileChange,
    handleUpload,
  };
};
