import React from "react";
import { SummaryDisplayProps, LogEntry } from "../uploadProcessor/uploadProcessorType";
import { useUploadProgressSummary } from "../uploadProcessor/uploadProcessorHook";
import { UploadProcessDisplay } from "../uploadProcessor/uploadProcessorSummaryUI";
import SplitProcessorSummaryUI from "../splitProcessor/splitProcessorSummaryUI";
import S3UploadSummaryUI from "../s3Manager/s3UploadSummaryUI";

export const SummaryDisplay: React.FC<SummaryDisplayProps> = ({
  taskLogs,
  uploadStatuses,
}) => {
  const { excelProcessingStatus, s3UploadStatus } = useUploadProgressSummary({
    uploadStatuses,
    taskLogs,
  });

  const uploadAndScriptLogs = taskLogs["uploadAndScript"] || [];
  const splitFilesLogs = taskLogs["splitFiles"] || [];

  const latestSplitLog = splitFilesLogs[splitFilesLogs.length - 1] as LogEntry & { splitMessage?: string; summary?: { totalSplitFilesGenerated: number; splitErrors: number; totalExpectedPagesFromCsv: number; } };

  return (
    <div className="mt-4 text-black h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-1">Task Logs</h3>
      <div className="bg-gray-200 p-2 rounded flex-1 overflow-y-auto min-h-30">
        {uploadAndScriptLogs.length > 0 && (
          <div key="uploadAndScript" className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold capitalize">Upload and Script</h4>
            </div>
            <div className="bg-gray-100 p-2 rounded">
              {excelProcessingStatus && (
                <UploadProcessDisplay
                  title="Excel Processing Progress"
                  progress={excelProcessingStatus.progress}
                  total={excelProcessingStatus.totalFiles}
                  processed={excelProcessingStatus.processedFiles}
                  successful={excelProcessingStatus.successfulFiles}
                  notFound={excelProcessingStatus.notFoundFiles}
                  errors={excelProcessingStatus.errorFiles}
                  badRowsDetails={excelProcessingStatus.badRowsDetails}
                />
              )}
            </div>
          </div>
        )}

        {s3UploadStatus && (
          <div key="s3Upload" className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold capitalize">S3 Upload</h4>
            </div>
            <div className="bg-gray-100 p-2 rounded">
              <S3UploadSummaryUI
                title="S3 Upload Progress"
                s3UploadStatus={s3UploadStatus}
                displayType="aggregate"
                unit="files"
              />
            </div>
          </div>
        )}

        {latestSplitLog && latestSplitLog.summary && (
          <div key="splitProcessor" className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold capitalize">Split Processor</h4>
            </div>
            <div className="bg-gray-100 p-2 rounded">
              <SplitProcessorSummaryUI
                splitMessage={latestSplitLog.splitMessage || ""}
                totalSplitFilesGenerated={latestSplitLog.summary.totalSplitFilesGenerated}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
