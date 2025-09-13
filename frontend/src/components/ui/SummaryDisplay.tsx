import React from 'react';

interface SummaryDisplayProps {
  taskLogs: {[key: string]: any};
}

const SummaryDisplay: React.FC<SummaryDisplayProps> = ({ taskLogs }) => {
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
                <pre>{JSON.stringify(log, null, 2)}</pre>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SummaryDisplay;
