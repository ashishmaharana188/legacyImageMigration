import React from "react";
import { useUploadProgressSummary } from "../../api/uploadProcessor/uploadProcessorHook";
import { UploadProgressDisplay, SplitSummaryDisplay } from "../../api/uploadProcessor/uploadProcessorSummaryUI";
import { UploadStatus } from "../../api/uploadProcessor/uploadProcessorType";

interface ProgressTrackingTaskProps {
  uploadStatuses: UploadStatus[];
  taskLogs: { [key: string]: any[] };
}

const ProgressTrackingTask: React.FC<ProgressTrackingTaskProps> = ({
  uploadStatuses,
  taskLogs,
}) => {
  const { excelProcessingStatus, splitSummary, s3UploadStatus } = useUploadProgressSummary({
    uploadStatuses,
    taskLogs,
  });

  return (
    <div>
      {s3UploadStatus && (
        <UploadProgressDisplay
          title="S3 Upload Progress"
          displayType="aggregate"
          progress={s3UploadStatus.progress}
          total={s3UploadStatus.totalFiles}
          processed={s3UploadStatus.processedFiles}
          unit="directories"
        />
      )}
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
      {splitSummary && (
        <SplitSummaryDisplay
          title="File Splitting Progress"
          splitSummary={splitSummary}
        />
      )}
    </div>
  );
};

export default ProgressTrackingTask;
