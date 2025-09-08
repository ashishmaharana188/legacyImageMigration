import React from 'react';

interface FileResponse {
  statusCode?: number;
  message?: string;
  originalFile?: string;
  processedFile?: string;
  nextContinuationToken?: string;
  summary?: {
    totalRows: number;
    successfulRows: number;
    errors: number;
    notFound: number;
    successfulInserts: number;
    unsuccessfulCount: number;
    totalPageCount: number;
    totalSplitImages: number;
  };
  splitSummary?: {
    totalOriginalFilesProcessed: number;
    totalExpectedSplits: number;
    totalSplitFilesGenerated: number;
    splitErrors: number;
    totalExpectedPagesFromCsv: number;
  };
  downloadUrl?: string;
  fileUrls?: Array<{ row: number; url: string; pageCount: number }>;
  splitFiles?: string[];
  error?: string;
  directories?: string[];
  files?: S3File[];
}

interface S3File {
  key: string;
  lastModified?: string;
}

interface SummaryDisplayProps {
  response: FileResponse | null;
  logs: { status: string; errors: string[] };
}

const SummaryDisplay: React.FC<SummaryDisplayProps> = ({ response, logs }) => {
  return (
    <div className="mt-4 text-black" id="s3uploadprogress">
      <h3 className="text-lg font-semibold">Progress</h3>
      <div className="bg-gray-200 p-2 rounded overflow-auto min-h-30">
        {logs.status && <p>{logs.status}</p>}
        {logs.errors.map((err, index) => (
          <p key={index} className="text-red-500">
            Count of errors while doing something: {err}
          </p>
        ))}
        {response?.summary && (
          <div className="mt-2">
            <h4 className="font-semibold">PDF Processing Summary:</h4>
            <p>Total Rows: {response.summary.totalRows}</p>
            <p>Successful Rows: {response.summary.successfulRows}</p>
            <p>Bad Rows: {response.summary.unsuccessfulCount}</p>
          </div>
        )}
        {response?.splitSummary && (
          <div className="mt-2">
            <h4 className="font-semibold">File Splitting Summary:</h4>
            <p>
              Total Files for Splitting:{" "}
              {response.splitSummary.totalOriginalFilesProcessed}
            </p>
            <p>
              Total Expected Splits (Internal):{" "}
              {response.splitSummary.totalExpectedSplits}
            </p>
            <p>
              Total Split Images:{" "}
              {response.splitSummary.totalSplitFilesGenerated}
            </p>
            <p>
              Total Expected Pages (from CSV):{" "}
              {response.splitSummary.totalExpectedPagesFromCsv}
            </p>
            <p>Split Errors: {response.splitSummary.splitErrors}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryDisplay;
