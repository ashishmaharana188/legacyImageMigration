import { UploadStatus, LogEntry, S3UploadProgress } from "../types";
import React from "react";

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface MessageProcessorProps {
  updateTaskLog: (taskKey: string, log: LogEntry) => void;
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
  setS3UploadProgress: React.Dispatch<React.SetStateAction<S3UploadProgress>>;
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  progressAccumulator: React.MutableRefObject<S3UploadProgress>;
}

export const createWebSocketMessageProcessor = ({
  updateTaskLog,
  setUploadStatuses,
  setS3UploadProgress,
  setIsConnected,
  progressAccumulator,
}: MessageProcessorProps) => {
  const processMessage = (data: WebSocketMessage) => {
    if (!data || !data.type) return;

    switch (data.type) {
      case "welcome":
        setIsConnected(true);
        break;

      case "uploadProgress":
        setUploadStatuses((prev) => {
          const newStatus: UploadStatus = {
            fileName: data.fileName,
            progress: data.progress,
            status: "Uploading",
          };
          const index = prev.findIndex((f) => f.fileName === data.fileName);
          if (index > -1) {
            const updated = [...prev];
            updated[index] = { ...updated[index], ...newStatus };
            return updated;
          }
          return [...prev, newStatus];
        });
        break;

      case "excelProcessingUpdate":
        updateTaskLog("uploadAndScript", {
          id: "LIVE_EXCEL_PROGRESS",
          status: "Processing",
          totalRows: data.totalRows,
          processedRows: data.processedRows,
          successfulRows: data.successfulRows,
          errors: data.errors,
          notFound: data.notFound,
          progress:
            data.totalRows > 0
              ? Math.round((data.processedRows / data.totalRows) * 100)
              : 0,
          message: `Processing Row ${data.processedRows} / ${data.totalRows}`,
        });
        break;

      case "splitProgressUpdate":
      case "splitProgressComplete":
        const totalExpected = data.totalExpectedPagesFromCsv || 0;
        const generated = data.totalSplitFilesGenerated || 0;
        const progress =
          totalExpected > 0 ? Math.round((generated / totalExpected) * 100) : 0;

        updateTaskLog("splitFiles", {
          id: "LIVE_SPLIT_PROGRESS",
          status: data.status || "Processing",
          totalRows: totalExpected,
          processedRows: generated,
          successfulRows: generated,
          errors: data.splitErrors || 0,
          progress: progress,
          message: data.message || `Generated ${generated} files...`,
        });
        break;

      case "sanityCheckUpdate":
        updateTaskLog("sanityCheck", {
          id: "sanityCheck",
          status: "Running",
          message: data.message,
          progress: data.progress,
          duplicates: data.duplicates,
        });
        break;

      case "s3-directory-progress":
      case "complete": {
        // [FIX] Destructure completedDirectories to match the backend payload
        const { completedDirectories, totalDirectories, currentDirectory } =
          data;

        // Fallback in case old data structure is ever passed
        const safeProcessedDirectories =
          completedDirectories || data.processedDirectories || 0;

        // 1. Update S3 Context State (for Breadcrumbs/Folder counts)
        if (data.type === "s3-directory-progress") {
          progressAccumulator.current = {
            processedDirectories: safeProcessedDirectories,
            totalDirectories: totalDirectories || 0,
            currentDirectory: currentDirectory || "",
          };
          setS3UploadProgress({
            processedDirectories: safeProcessedDirectories,
            totalDirectories: totalDirectories || 0,
            currentDirectory: currentDirectory || "",
          });
        }

        // 2. [FIX] Update Task Log for Global Summary Display
        const percent =
          totalDirectories > 0
            ? Math.round((safeProcessedDirectories / totalDirectories) * 100)
            : 0;

        updateTaskLog("s3Upload", {
          id: "LIVE_S3_PROGRESS",
          status: data.type === "complete" ? "Completed" : "Uploading",
          progress: data.type === "complete" ? 100 : percent,
          total: totalDirectories,
          processedRows: safeProcessedDirectories, // Using processedRows to fit LogEntry interface
          message:
            data.type === "complete"
              ? "S3 Upload Completed"
              : `Uploading: ${currentDirectory || "Processing..."}`,
          timestamp: new Date().toISOString(),
        });

        // 3. Update UploadStatuses (for S3 Specific UI)
        setUploadStatuses((prev) =>
          prev.map((item) => {
            if (
              item.fileName === "Original File" ||
              item.fileName === "Split Files"
            ) {
              const successFiles =
                data.successfulFilesCount || item.successfulFiles || 0;
              const errorFiles = data.failedFilesCount || item.errorFiles || 0;

              return {
                ...item,
                status: data.type === "complete" ? "completed" : "Uploading",
                progress: data.type === "complete" ? 100 : percent,
                totalFiles: successFiles + errorFiles || totalDirectories,
                processedFiles: successFiles + errorFiles,
                successfulFiles: successFiles,
                errorFiles: errorFiles,
              };
            }
            return item;
          }),
        );
        break;
      }

      case "s3-upload-start": {
        const totalFolders = data.totalFolders || 0;
        const uploadKind = data.uploadKind || "S3";
        const aggregateFileName =
          uploadKind === "Splits" ? "Split Files" : "Original File";

        updateTaskLog("s3Upload", {
          id: `LIVE_S3_${uploadKind}_PROGRESS`,
          status: "Uploading",
          progress: 0,
          total: totalFolders,
          processedRows: 0,
          message: `${uploadKind} upload started: ${totalFolders} folders queued`,
          timestamp: new Date().toISOString(),
        });

        setUploadStatuses((prev) => [
          ...prev.filter(
            (item) =>
              item.fileName !== aggregateFileName &&
              item.uploadKind !== uploadKind,
          ),
          {
            fileName: aggregateFileName,
            status: "Uploading",
            progress: 0,
            jobId: data.jobId,
            uploadKind,
            totalFiles: totalFolders,
            processedFiles: 0,
            successfulFiles: 0,
            errorFiles: 0,
          },
        ]);
        break;
      }

      case "s3-folder-start": {
        setUploadStatuses((prev) => [
          ...prev.filter((item) => item.folderId !== data.folderId),
          {
            fileName: data.folderName || data.s3Prefix || "S3 folder",
            status: "Uploading",
            progress: 0,
            jobId: data.jobId,
            folderId: data.folderId,
            uploadKind: data.uploadKind,
            folderIndex: data.folderIndex,
            totalFolders: data.totalFolders,
            totalDirectories: 0,
            processedDirectories: 0,
            successfulFiles: 0,
            errorFiles: 0,
            currentDirectory: data.s3Prefix || "",
          },
        ]);
        break;
      }

      case "s3-folder-progress": {
        const totalDirectories = data.totalDirectories || 0;
        const completedDirectories = data.completedDirectories || 0;
        const progress =
          totalDirectories > 0
            ? Math.round((completedDirectories / totalDirectories) * 100)
            : 0;

        progressAccumulator.current = {
          processedDirectories: completedDirectories,
          totalDirectories,
          currentDirectory: data.currentDirectory || "",
        };
        setS3UploadProgress(progressAccumulator.current);

        setUploadStatuses((prev) =>
          prev.map((item) =>
            item.folderId === data.folderId
              ? {
                  ...item,
                  status: "Uploading",
                  progress,
                  totalDirectories,
                  processedDirectories: completedDirectories,
                  currentDirectory:
                    data.currentDirectory || item.currentDirectory,
                  successfulFiles:
                    data.successfulFilesCount ?? item.successfulFiles ?? 0,
                  errorFiles: data.failedFilesCount ?? item.errorFiles ?? 0,
                  processedFiles:
                    data.processedFiles ??
                    (data.successfulFilesCount || 0) +
                      (data.failedFilesCount || 0),
                }
              : item,
          ),
        );
        break;
      }

      case "s3-folder-complete": {
        const completedFolders = data.completedFolders || 0;
        const totalFolders = data.totalFolders || 0;
        const aggregateProgress =
          totalFolders > 0
            ? Math.round((completedFolders / totalFolders) * 100)
            : 0;
        const uploadKind = data.uploadKind || "S3";
        const aggregateFileName =
          uploadKind === "Splits" ? "Split Files" : "Original File";
        const failedFiles = data.failedFilesCount || 0;
        const aggregateFailedFiles = data.aggregateFailedFiles ?? failedFiles;
        const aggregateSuccessfulFiles =
          data.aggregateSuccessfulFiles ?? data.successfulFilesCount ?? 0;

        updateTaskLog("s3Upload", {
          id: `LIVE_S3_${uploadKind}_PROGRESS`,
          status: aggregateProgress >= 100 ? "Completed" : "Uploading",
          progress: aggregateProgress,
          total: totalFolders,
          processedRows: completedFolders,
          message: `${uploadKind}: ${completedFolders}/${totalFolders} folders uploaded`,
          timestamp: new Date().toISOString(),
        });

        setUploadStatuses((prev) =>
          prev.map((item) => {
            if (item.folderId === data.folderId) {
              return {
                ...item,
                status:
                  data.status ||
                  (failedFiles > 0 ? "completed_with_errors" : "completed"),
                progress: 100,
                processedDirectories:
                  item.totalDirectories || item.processedDirectories || 0,
                successfulFiles: data.successfulFilesCount || 0,
                errorFiles: failedFiles,
                errorMessage: data.errorMessage,
              };
            }

            if (
              !item.folderId &&
              (item.fileName === aggregateFileName ||
                item.uploadKind === uploadKind)
            ) {
              return {
                ...item,
                status:
                  aggregateProgress >= 100
                    ? aggregateFailedFiles > 0
                      ? "completed_with_errors"
                      : "completed"
                    : "Uploading",
                progress: aggregateProgress,
                totalFiles: totalFolders,
                processedFiles: completedFolders,
                successfulFiles: aggregateSuccessfulFiles,
                errorFiles: aggregateFailedFiles,
              };
            }

            return item;
          }),
        );
        break;
      }

      case "s3-upload-complete": {
        const uploadKind = data.uploadKind || "S3";
        const aggregateFileName =
          uploadKind === "Splits" ? "Split Files" : "Original File";
        const failedFiles = data.failedFilesCount || 0;

        updateTaskLog("s3Upload", {
          id: `LIVE_S3_${uploadKind}_PROGRESS`,
          status: failedFiles > 0 ? "Completed with errors" : "Completed",
          progress: 100,
          total: data.totalFolders || 0,
          processedRows: data.completedFolders || data.totalFolders || 0,
          message: `${uploadKind} upload completed`,
          timestamp: new Date().toISOString(),
        });

        setUploadStatuses((prev) =>
          prev.map((item) =>
            !item.folderId &&
            (item.fileName === aggregateFileName ||
              item.uploadKind === uploadKind)
              ? {
                  ...item,
                  status:
                    data.status ||
                    (failedFiles > 0 ? "completed_with_errors" : "completed"),
                  progress: 100,
                  totalFiles: data.totalFolders || item.totalFiles || 0,
                  processedFiles:
                    data.completedFolders ||
                    data.totalFolders ||
                    item.processedFiles ||
                    0,
                  successfulFiles: data.successfulFilesCount || 0,
                  errorFiles: failedFiles,
                }
              : item,
          ),
        );
        break;
      }

      case "sqlProgressUpdate":
      case "mongoProgressUpdate": {
        const isSql = data.type === "sqlProgressUpdate";
        const liveId = isSql ? "LIVE_SQL_PROGRESS" : "LIVE_MONGO_PROGRESS";
        const metrics = data.metrics || {};

        updateTaskLog("imageDataTransfer", {
          id: liveId,
          status: data.status,
          totalRows: data.total,
          processedRows: data.processed,
          progress:
            data.total > 0
              ? Math.round((data.processed / data.total) * 100)
              : 0,
          message:
            data.message ||
            (data.status === "Completed"
              ? "Task Completed"
              : `Processing... ${data.processed}/${data.total}`),
          subTask: data.subTask,
          metrics: metrics,
          successfulRows:
            (metrics.inserted || 0) +
            (metrics.updated || 0) +
            (metrics.synced || 0),
          errors: metrics.failed || 0,
        });

        if (data.status === "Completed") {
          const historyId = `${data.subTask}_DONE_${Date.now()}`;
          const summaryMsg = isSql
            ? `SQL Task (${data.subTask}) Completed.`
            : `Mongo Task (${data.subTask}) Completed.`;

          updateTaskLog("imageDataTransfer", {
            id: historyId,
            status: "Success",
            message: summaryMsg,
            timestamp: new Date().toISOString(),
            metrics: metrics,
            subTask: data.subTask,
            totalRows: data.total,
            successfulRows:
              (metrics.inserted || 0) +
              (metrics.updated || 0) +
              (metrics.synced || 0),
            errors: metrics.failed || 0,
          });
        }

        if (data.status === "Error") {
          updateTaskLog("imageDataTransfer", {
            id: `${data.subTask}_ERR_${Date.now()}`,
            status: "Error",
            message: data.message || "Unknown Error occurred",
            timestamp: new Date().toISOString(),
            subTask: data.subTask,
          });
        }
        break;
      }
    }
  };

  return { processMessage };
};
