import React from "react";
import {
  UploadStatus,
  FileResponse,
  RequestConfig,
} from "./uploadProcessorType";
import { uploadExcelFile, runFallbackCheck } from "./uploadProcessorService";
import {
  logUploadStart,
  logUploadSuccess,
  logUploadFailure,
} from "./uploadProcessorLog";

const TASK_NAME = "uploadAndScript";

/**
 * Handles validation and state updates for the file input field.
 */
export const handleFileChange = (
  event: React.ChangeEvent<HTMLInputElement>,
  setSelectedFile: React.Dispatch<React.SetStateAction<File | null>>,
  setUploadMessage: React.Dispatch<React.SetStateAction<string>>
) => {
  const file = event.target.files?.[0];
  // Standard browser File object uses .name
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

/**
 * Internal execution engine for both Main and Fallback routes.
 * UPDATED: Does not manually set 100% progress to allow live WebSocket updates.
 */
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

  // Initialize the Sidebar Summary entry
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

    // Final Log update
    // Note: Iterative counts (Successful/Failed) are handled via WebSocket messages.
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

/**
 * Main Trigger for the 'Upload and Process' button.
 */
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
    operationName: "Transferring Files",
    setUploadStatuses,
    setIsUploading,
  });
};

/**
 * Main Trigger for the 'Run Fallback Check' button.
 */
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
    operationName: "Running Fallback",
  });
};
