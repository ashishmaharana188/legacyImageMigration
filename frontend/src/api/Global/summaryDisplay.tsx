import React from "react";
import {SummaryDisplayProps } from "../uploadProcessor/uploadProcessorType";
import { useUploadProgressSummary } from "../uploadProcessor/uploadProcessorHook";
import { UploadProgressDisplay } from "../uploadProcessor/uploadProcessorSummaryUI";



export const SummaryDisplay: React.FC<SummaryDisplayProps> = ({
  taskLogs,
  uploadStatuses,
}) => {
  const { excelProcessingStatus } = useUploadProgressSummary({
    uploadStatuses,
    taskLogs,
  });

  const uploadAndScriptLogs = taskLogs["uploadAndScript"] || [];

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
                <UploadProgressDisplay
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
      </div>
    </div>
  );
};
