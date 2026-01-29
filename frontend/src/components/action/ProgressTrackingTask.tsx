import React, { useMemo } from "react";
import { useUploadProgressSummary } from "../../api/uploadProcessor/uploadProcessorHook";
import { UploadProcessDisplay } from "../../api/uploadProcessor/uploadProcessorSummaryUI";
import { SplitProcessDisplay } from "../../api/splitProcessor/splitProcessorSummaryUI";
import { UploadStatus, SplitSummary } from "../../types/index";

interface ProgressTrackingTaskProps {
  uploadStatuses: UploadStatus[];
  taskLogs: { [key: string]: any[] };
  taskName: string; // <--- FIX: This is key to preventing duplication
}

const ProgressTrackingTask: React.FC<ProgressTrackingTaskProps> = ({
  uploadStatuses,
  taskLogs,
  taskName,
}) => {
  const { excelProcessingStatus, s3UploadStatus } = useUploadProgressSummary({
    uploadStatuses,
    taskLogs,
  });

  const splitSummary = useMemo((): SplitSummary | null => {
    const statusObj = uploadStatuses.find(
      (s) => s.fileName === "splitting_progress"
    );
    if (statusObj?.splitSummary) return statusObj.splitSummary;
    return null;
  }, [uploadStatuses]);

  const getSplitProgress = () => {
    if (!splitSummary) return 0;
    const total = splitSummary.totalExpectedPagesFromCsv || 0;
    const current = splitSummary.totalSplitFilesGenerated || 0;
    return total > 0 ? (current / total) * 100 : 0;
  };

  const isUploadTask = taskName === "uploadAndScript";
  const isSplitTask = taskName === "splitFiles";

  return (
    <div>
      {/* FIX: Only show Upload bars if we are in the Upload card */}
      {isUploadTask && (
        <>
          {s3UploadStatus && (
            <UploadProcessDisplay
              title="S3 Upload Progress"
              progress={s3UploadStatus.progress}
              total={s3UploadStatus.totalFiles}
              processed={s3UploadStatus.processedFiles}
              successful={0}
              errors={0}
              notFound={0}
              unit="directories"
            />
          )}

          {excelProcessingStatus && (
            <UploadProcessDisplay
              title="Excel Processing Progress"
              progress={excelProcessingStatus.progress}
              total={excelProcessingStatus.totalFiles}
              processed={excelProcessingStatus.processedFiles}
              successful={excelProcessingStatus.successfulFiles}
              notFound={excelProcessingStatus.notFoundFiles}
              errors={excelProcessingStatus.errorFiles}
            />
          )}
        </>
      )}

      {/* FIX: Only show Split bar if we are in the Split card */}
      {isSplitTask && splitSummary && (
        <SplitProcessDisplay
          title="File Splitting Progress"
          progress={getSplitProgress()}
          total={splitSummary.totalExpectedPagesFromCsv}
          successful={splitSummary.totalSplitFilesGenerated}
          errors={splitSummary.splitErrors}
        />
      )}
    </div>
  );
};

export default ProgressTrackingTask;
