import React, { useState, useEffect } from 'react';
import ProgressTrackingUI from '../ui/ProgressTrackingUI';

interface UploadStatus {
    fileName: string;
    progress?: number;
    status?: string;
    isDirectory?: boolean;
    totalFiles?: number;
    processedFiles?: number;
    successfulFiles?: number;
    errorFiles?: number;
    notFoundFiles?: number;
    badRowsDetails?: Array<{
        rowNumber: number;
        id_fund: string;
        id_trtype: string;
        id_ihno: string;
        id_path: string;
        id_acno: string;
        page_count_status: string | number;
    }>;
}

interface ProgressTrackingTaskProps {
    uploadStatuses: UploadStatus[];
    taskLogs: { [key: string]: any[] };
}

const ProgressTrackingTask: React.FC<ProgressTrackingTaskProps> = ({ uploadStatuses, taskLogs }) => {
    const [excelProcessingStatus, setExcelProcessingStatus] = useState<UploadStatus | null>(null);
    const [splitSummary, setSplitSummary] = useState<any | null>(null);
    const [s3UploadStatus, setS3UploadStatus] = useState<UploadStatus | null>(null);

    useEffect(() => {
        const excelStatus = uploadStatuses.find(s => s.fileName === "excel_processing");
        setExcelProcessingStatus(excelStatus || null);

        const splitLog = taskLogs.uploadAndScript?.find(log => log.splitSummary);
        if (splitLog) {
            setSplitSummary(splitLog.splitSummary);
        } else {
            setSplitSummary(null);
        }

        const s3Status = uploadStatuses.find(s => s.fileName === "s3_upload_progress");
        setS3UploadStatus(s3Status || null);

    }, [uploadStatuses, taskLogs]);

    return (
        <div>
            {s3UploadStatus && (
                <ProgressTrackingUI
                    title="S3 Upload Progress"
                    displayType="aggregate"
                    progress={s3UploadStatus.progress}
                    total={s3UploadStatus.totalFiles}
                    processed={s3UploadStatus.processedFiles}
                    unit="directories"
                />
            )}
            {excelProcessingStatus && (
                <ProgressTrackingUI
                    title="Excel Processing Progress"
                    progress={excelProcessingStatus.progress}
                    total={excelProcessingStatus.totalFiles}
                    processed={excelProcessingStatus.processedFiles}
                    successful={excelProcessingStatus.successfulFiles}
                    errors={excelProcessingStatus.errorFiles}
                    notFound={excelProcessingStatus.notFoundFiles}
                    badRowsDetails={excelProcessingStatus.badRowsDetails}
                />
            )}
            {splitSummary && (
                <ProgressTrackingUI
                    title="File Splitting Progress"
                    progress={
                        splitSummary.totalExpectedSplits > 0
                            ? (splitSummary.totalSplitFilesGenerated / splitSummary.totalExpectedSplits) * 100
                            : 0
                    }
                    total={splitSummary.totalExpectedSplits}
                    processed={splitSummary.totalSplitFilesGenerated}
                    errors={splitSummary.splitErrors}
                    currentlySplitting={splitSummary.currentlySplittingFiles}
                />
            )}
        </div>
    );
};

export default ProgressTrackingTask;