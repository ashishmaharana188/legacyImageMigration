import React from "react";
import { UploadStatus, FileResponse, RequestConfig } from "./splitProcessorType";

const _executeRequest = async ({
  endpoint,
  updateTaskLog,
  setUploadMessage,
  setLoading,
  logId,
  operationName,
}: RequestConfig) => {
  setLoading(true);
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


export const handleSplitFile = async(
    updateTaskLog: (task: string, log: unknown) => void,
    clearTaskLog: (task: string) => void,
    setSplitMessage: React.Dispatch<React.SetStateAction<string>>,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>,
    setIsUploading: React.Dispatch<React.SetStateAction<boolean>>,
    setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>
) => {
        await _executeRequest({
            endpoint: "split-excel",
            updateTaskLog,
            setSplitMessage,
            setLoading,
            logId: "upload-status",
            operationName: "Uploading",
            setUploadStatuses,
            setIsUploading,
        })
}
