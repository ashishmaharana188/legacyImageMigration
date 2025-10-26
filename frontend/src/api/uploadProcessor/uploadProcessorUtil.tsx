import React from "react";
import { UploadStatus, FileResponse, RequestConfig } from "./uploadProcessorType";
import { uploadExcelFile, runFallbackCheck } from "./uploadProcessorService";
import { logUploadStart, logUploadSuccess, logUploadFailure, updateUploadStatuses } from "./uploadProcessorLog";


export const handleFileChange = (
  event: React.ChangeEvent<HTMLInputElement>,
  setSelectedFile: React.Dispatch<React.SetStateAction<File | null>>,
  setUploadMessage: React.Dispatch<React.SetStateAction<string>>,
) => {
  const file = event.target.files?.[0];
  if (file && file.type.includes("spreadsheetml")) {
    setSelectedFile(file);
    setUploadMessage("");
  } else {
    setUploadMessage("Please select a valid Excel file.");
  }
};

const _executeRequest = async ({
  endpoint,
  selectedFile,
  updateTaskLog,
  setUploadMessage,
  setLoading,
  logId,
  operationName,
  setUploadStatuses,
  setIsUploading,
}: RequestConfig) => {
  setLoading(true);
  if (setIsUploading) setIsUploading(true);
  setUploadMessage(`${operationName}...`);
  logUploadStart(updateTaskLog, operationName, logId);
  if (setUploadStatuses) {
    updateUploadStatuses(setUploadStatuses, "in-progress", undefined);
  }



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
    const { summary, ...restData } = resData;
    const totalRows = summary?.totalRows || 0;
    const badRows = summary?.errors || 0;

    let finalStatus: "success" | "failed" | "in-progress" = "success";
    if (badRows > 0) {
      finalStatus = "failed";
    } else if (totalRows > 0) {
      finalStatus = "success";
    } else {
      finalStatus = "success";
    }

    logUploadSuccess(updateTaskLog, operationName, logId, summary, restData);
    if (setUploadStatuses) {
      updateUploadStatuses(setUploadStatuses, finalStatus, summary);
    }
  } catch (error: unknown) {
    const errorMessage =
      (error as Error).message;
    setUploadMessage(`${operationName} failed: ${errorMessage}`);
    logUploadFailure(updateTaskLog, operationName, logId, errorMessage);
    if (setUploadStatuses) {
      updateUploadStatuses(setUploadStatuses, "failed", undefined, errorMessage);
    }
  } finally {
    setLoading(false);
    if (setIsUploading) setIsUploading(true);
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
  clearTaskLog("uploadAndScript");
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
  clearTaskLog("uploadAndScript");
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
