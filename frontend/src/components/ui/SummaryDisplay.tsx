import React, { useState, useCallback } from 'react';
import axios from 'axios';

interface SummaryItem {
  fileName: string;
  status: string;
}

interface SummaryDisplayProps {
  taskLogs: {[key: string]: any};
  summaryData: SummaryItem[];
  uploadProgress: Record<string, number>;
}

const SummaryDisplay: React.FC<SummaryDisplayProps> = ({ taskLogs, summaryData, uploadProgress }) => {

  const [expandedLogContent, setExpandedLogContent] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const toggleBadRowsDisplay = useCallback(async (filePath: string, logId: string) => {
    if (expandedLogId === logId) {
      setExpandedLogContent(null);
      setExpandedLogId(null);
    } else {
      try {
        const res = await axios.get(`http://localhost:3000/download-generated-file/${filePath}`);
        setExpandedLogContent(res.data);
        setExpandedLogId(logId);
      } catch (error) {
        console.error("Failed to fetch bad rows content:", error);
        setExpandedLogContent("Failed to load content.");
        setExpandedLogId(logId);
      }
    }
  }, [expandedLogId]);

  const renderSummary = (log: any, logKey: string) => {
    if (log.insertedRows !== undefined) {
      return (
        <div>
          <p>Inserted Rows: {log.insertedRows}</p>
          <p>Error Rows: {log.badRows}</p>
          {log.badRowsFilePath && (log.badRows > 0) && (
            <>
              <button onClick={() => toggleBadRowsDisplay(log.badRowsFilePath, logKey)}>
                {expandedLogId === logKey ? 'Hide Bad Rows' : 'Show Bad Rows'}
              </button>
              {expandedLogId === logKey && (
                <pre className="bg-gray-100 p-2 rounded mt-2 whitespace-pre-wrap text-sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {expandedLogContent}
                </pre>
              )}
            </>
          )}
        </div>
      );
    } else if (log.updatedFolioRows !== undefined) {
      return (
        <div>
          <p>Updated Folio Rows: {log.updatedFolioRows}</p>
          <p>Updated Transaction Rows: {log.updatedTransactionRows}</p>
          {log.badRowsFilePath && (log.badRows > 0) && (
            <>
              <button onClick={() => toggleBadRowsDisplay(log.badRowsFilePath, logKey)}>
                {expandedLogId === logKey ? 'Hide Bad Rows' : 'Show Bad Rows'}
              </button>
              {expandedLogId === logKey && (
                <pre className="bg-gray-100 p-2 rounded mt-2 whitespace-pre-wrap text-sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {expandedLogContent}
                </pre>
              )}
            </>
          )}
        </div>
      );
    } else if (log.totalRows !== undefined) {
      return (
        <div>
          <p>Total Rows: {log.totalRows}</p>
          <p>Successful Rows: {log.successfulRows}</p>
          <p>Bad Rows: {log.badRows}</p>
          {log.badRowsFilePath && (log.badRows > 0) && (
            <>
              <button onClick={() => toggleBadRowsDisplay(log.badRowsFilePath, logKey)}>
                {expandedLogId === logKey ? 'Hide Bad Rows' : 'Show Bad Rows'}
              </button>
              {expandedLogId === logKey && (
                <pre className="bg-gray-100 p-2 rounded mt-2 whitespace-pre-wrap text-sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {expandedLogContent}
                </pre>
              )}
            </>
          )}
        </div>
      );
    }
    return <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(log, null, 2)}</pre>;
  }

  return (
    <div className="mt-4 text-black" id="s3uploadprogress">
      <h3 className="text-lg font-semibold">Task Logs</h3>
      <div className="bg-gray-200 p-2 rounded overflow-auto min-h-30">
        {Object.entries(taskLogs).map(([task, log]) => (
          <div key={task} className="mb-4">
            <h4 className="font-semibold capitalize">{task}</h4>
            <div className="bg-gray-100 p-2 rounded">
              {typeof log === 'string' ? (
                <p>{log}</p>
              ) : (
                renderSummary(log, task) // Pass 'task' as logKey
              )}
            </div>
          </div>
        ))}
      </div>

      {summaryData.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold">Summary</h3>
          <div className="bg-gray-200 p-2 rounded">
            {summaryData.map((item, index) => (
              <div key={index} className="mb-2">
                <p>File: {item.fileName}</p>
                <p>Status: {item.status}</p>
                {uploadProgress[item.fileName] !== undefined && (
                  <div className="w-full bg-gray-300 rounded-full h-2.5 dark:bg-gray-700">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{ width: `${uploadProgress[item.fileName]}%` }}
                    ></div>
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-500">{uploadProgress[item.fileName]}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(uploadProgress).length > 0 && summaryData.length === 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold">Upload Progress</h3>
          <div className="bg-gray-200 p-2 rounded">
            {Object.entries(uploadProgress).map(([fileName, progress]) => (
              <div key={fileName} className="mb-2">
                <p>File: {fileName}</p>
                <div className="w-full bg-gray-300 rounded-full h-2.5 dark:bg-gray-700">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{ width: `${progress}%` }}
                  ></div>
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-500">{progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SummaryDisplay;
