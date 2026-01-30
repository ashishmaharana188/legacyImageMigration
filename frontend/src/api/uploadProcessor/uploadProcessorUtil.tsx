import React from "react";
import {
  UploadStatus,
  FileResponse,
  RequestConfig, // This will now work with the fix in Step 1
} from "./uploadProcessorType";
import { uploadExcelFile, runFallbackCheck } from "./uploadProcessorService";
import {
  logUploadStart,
  logUploadSuccess,
  logUploadFailure,
} from "./uploadProcessorLog";

const TASK_NAME = "uploadAndScript";

export const handleFileChange = (
  event: React.ChangeEvent<HTMLInputElement>,
  setSelectedFile: React.Dispatch<React.SetStateAction<File | null>>,
  setUploadMessage: React.Dispatch<React.SetStateAction<string>>
) => {
  const file = event.target.files?.[0];
  // FIX: Use file.name instead of file.originalname
  if (
    file &&
    (file.type.includes("spreadsheetml") || file.name.endsWith(".xlsx"))
  ) {
    setSelectedFile(file);
    setUploadMessage("");
  } else {
    setUploadMessage("Please select a valid Excel file.");
  }
};

export const _executeRequest = async ({
  endpoint,
  selectedFile,
  updateTaskLog,
  setUploadMessage,
  setLoading,
  logId,
  operationName,
  setIsUploading,
}: RequestConfig) => {
  setLoading(true);
  if (setIsUploading) setIsUploading(true);
  setUploadMessage(`${operationName}...`);

  logUploadStart(updateTaskLog, operationName, logId);

  try {
    let resData: FileResponse;
    if (endpoint === "upload-excel") {
      resData = await uploadExcelFile(endpoint, selectedFile);
    } else if (endpoint === "run-fallback") {
      resData = await runFallbackCheck(endpoint, selectedFile);
    } else {
      throw new Error(`Unknown endpoint: ${endpoint}`);
    }

    setUploadMessage(resData.message || `${operationName} successful`);

    // Log the success to the sidebar table
    logUploadSuccess(
      updateTaskLog,
      operationName,
      logId,
      resData.summary,
      resData
    );
  } catch (error: unknown) {
    const errorMessage = (error as Error).message;
    setUploadMessage(`${operationName} failed: ${errorMessage}`);

    logUploadFailure(updateTaskLog, operationName, logId, errorMessage);
  } finally {
    setLoading(false);
    if (setIsUploading) setIsUploading(false);
  }
};

export const handleUpload = async (
  selectedFile: File | null,
  updateTaskLog: (task: string, log: unknown) => void,
  clearTaskLog: (task: string) => void,
  setUploadMessage: React.Dispatch<React.SetStateAction<string>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setIsUploading: React.Dispatch<React.SetStateAction<boolean>>,
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>
) => {
  if (!selectedFile) {
    setUploadMessage("Please select a file first.");
    return;
  }

  clearTaskLog(TASK_NAME);

  await _executeRequest({
    endpoint: "upload-excel",
    selectedFile,
    updateTaskLog,
    setUploadMessage,
    setLoading,
    logId: "upload-status",
    operationName: "Uploading",
    setUploadStatuses,
    setIsUploading,
  });
};

export const handleFallback = async (
  selectedFile: File | null,
  updateTaskLog: (task: string, log: unknown) => void,
  clearTaskLog: (task: string) => void,
  setUploadMessage: React.Dispatch<React.SetStateAction<string>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
) => {
  if (!selectedFile) {
    setUploadMessage("Please select a file first.");
    return;
  }

  clearTaskLog(TASK_NAME);

  await _executeRequest({
    endpoint: "run-fallback",
    selectedFile,
    updateTaskLog,
    setUploadMessage,
    setLoading,
    logId: "fallback-status",
    operationName: "Running fallback",
  });
};
