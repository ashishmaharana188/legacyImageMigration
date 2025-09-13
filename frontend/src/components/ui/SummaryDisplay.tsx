import React from 'react';

interface SummaryDisplayProps {
  taskLogs: {[key: string]: any};
}

const SummaryDisplay: React.FC<SummaryDisplayProps> = ({ taskLogs }) => {

  const renderSummary = (log: any) => {
    if (log.insertedRows !== undefined) {
      return (
        <div>
          <p>Inserted Rows: {log.insertedRows}</p>
          <p>Error Rows: {log.badRows}</p>
          {log.badRowsFilePath && (log.badRows > 0) && (
            <a href={`http://localhost:3000/download-generated-file/${log.badRowsFilePath.split('/').pop()}`} download>
              Download Bad Rows
            </a>
          )}
        </div>
      );
    }
    if (log.updatedFolioRows !== undefined) {
      return (
        <div>
          <p>Updated Folio Rows: {log.updatedFolioRows}</p>
          <p>Updated Transaction Rows: {log.updatedTransactionRows}</p>
          {log.badRowsFilePath && (log.badRows > 0) && (
            <a href={`http://localhost:3000/download-generated-file/${log.badRowsFilePath.split('/').pop()}`} download>
              Download Bad Rows
            </a>
          )}
        </div>
      );
    }
    return <pre>{JSON.stringify(log, null, 2)}</pre>;
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
                renderSummary(log)
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SummaryDisplay;
