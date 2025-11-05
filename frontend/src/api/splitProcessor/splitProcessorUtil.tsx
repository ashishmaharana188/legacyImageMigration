import React from "react";
import { UploadStatus, RequestConfig, SplitFileResponse } from "./splitProcessorType";
import { splitFile, splitFileWithMuPDF } from "./splitProcessorService";
import { logSplitStart, logSplitSuccess, logSplitFailure, updateSplitStatuses } from "./splitProcessorLog";


const _executeRequest = async ({
  endpoint,
  selectedFile,
  updateTaskLog,
  setSplitMessage,
  setLoading,
  logId,
  operationName,
  setUploadStatuses,
  setIsUploading,
}: RequestConfig) => {
  setLoading(true);
  if (setIsUploading) setIsUploading(true);
  setSplitMessage(`${operationName}...`);
  logSplitStart(updateTaskLog, operationName, logId);
  if (setUploadStatuses) {
    updateSplitStatuses(setUploadStatuses, "in-progress");
  }

  try {
    let resData: SplitFileResponse;
    if (endpoint === "split-files") {
      if (!selectedFile) {
        throw new Error("No file selected for splitting.");
      }
      resData = await splitFile(endpoint, selectedFile);
    } else if (endpoint === "split-mupdf") {
      resData = await splitFileWithMuPDF(endpoint);
    } else {
      throw new Error(`Unknown endpoint: ${endpoint}`);
    }
    setSplitMessage(resData.message || `${operationName} successful`);

    logSplitSuccess(updateTaskLog, operationName, logId, resData);
    if (setUploadStatuses) {
      updateSplitStatuses(setUploadStatuses, "success");
    }
  } catch (error: unknown) {
    const errorMessage =
      (error as Error).message;
    setSplitMessage(`${operationName} failed: ${errorMessage}`);
    logSplitFailure(updateTaskLog, operationName, logId, errorMessage);
    if (setUploadStatuses) {
      updateSplitStatuses(setUploadStatuses, "in-progress");
    }
  } finally {
    setLoading(false);
    if (setIsUploading) setIsUploading(false);
  }
};

export const handleSplitFiles = async (
  selectedFile: File | null,
  updateTaskLog: (task: string, log: unknown) => void,
  clearTaskLog: (task: string) => void,
  setSplitMessage: React.Dispatch<React.SetStateAction<string>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setIsUploading: React.Dispatch<React.SetStateAction<boolean>>,
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>
) => {
  if (!selectedFile) {
    setSplitMessage("Please select a file first.");
    return;
  }
  clearTaskLog("uploadAndScript");
  setUploadStatuses([]); // Clear previous upload progress
  await _executeRequest({
    endpoint: "split-files",
    selectedFile,
    updateTaskLog,
    setSplitMessage,
    setLoading,
    logId: "splitting-status",
    operationName: "Splitting files",
    setUploadStatuses,
    setIsUploading,
  });
};

export const handleSplitFilesWithMuPDF = async (
  selectedFile: File | null,
  updateTaskLog: (task: string, log: unknown) => void,
  clearTaskLog: (task: string) => void,
  setSplitMessage: React.Dispatch<React.SetStateAction<string>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setIsUploading: React.Dispatch<React.SetStateAction<boolean>>,
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>
) => {
  if (!selectedFile) {
    setSplitMessage("Please select a file first.");
    return;
  }
  clearTaskLog("uploadAndScript");
  setUploadStatuses([]); // Clear previous upload progress
  await _executeRequest({
    endpoint: "split-mupdf",
    selectedFile,
    updateTaskLog,
    setSplitMessage,
    setLoading,
    logId: "mupdf-splitting-status",
    operationName: "Splitting files with MuPDF",
    setUploadStatuses,
    setIsUploading,
  });
};
