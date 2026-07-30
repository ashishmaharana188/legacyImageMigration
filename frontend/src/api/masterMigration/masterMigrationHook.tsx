import { useState } from "react";
import { UseMasterMigrationHookProps } from "./masterMigrationType";
import {
  stagingValidationUpsert,
  masterStagingMongo,
} from "./masterMigrationService";

export const useMasterMigrationHook = ({
  updateTaskLog,
  clearTaskLog,
}: UseMasterMigrationHookProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [clientCode, setClientCode] = useState<string>("");
  const [fundCode, setFundCode] = useState<string>("");
  const [migrationType, setMigrationType] = useState<string>("");
  const [masterType, setMasterType] = useState<string>("");
  const [pushToMongo, setPushToMongo] = useState(true);

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
      const result = await stagingValidationUpsert(
        selectedFile,
        masterType,
        migrationType,
        pushToMongo,
      );

      setUploadStatus(
        `File integrity check: ${result.status}. ${result.message ?? ""}`,
      );

      updateTaskLog?.("MasterMigration", {
        id: crypto.randomUUID(),
        message: `File integrity check completed: ${result.status}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Error uploading file:", error);

      setUploadStatus(
        `Error: ${
          error.response?.data?.message ??
          error.message ??
          "File upload failed."
        }`,
      );

      updateTaskLog?.("MasterMigration", {
        id: crypto.randomUUID(),
        message: `File integrity check completed: ${error.response?.data?.message ?? error.message}`,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleETL = async () => {
    setUploadStatus("Processing master data...");

    try {
      await masterStagingMongo(
        clientCode,
        fundCode,
        migrationType,
        masterType,
        pushToMongo,
        selectedFile ?? undefined,
      );

      setUploadStatus("Master migration completed successfully.");
    } catch (error) {
      console.error(error);
      setUploadStatus("Master migration failed.");
    }
  };

  return {
    selectedFile,
    clientCode,
    setClientCode,
    migrationType,
    masterType,
    uploadStatus,
    fundCode,
    setFundCode,
    setMigrationType,
    setMasterType,
    pushToMongo,
    setPushToMongo,
    handleFileChange,
    handleUpload,
    handleETL,
  };
};
