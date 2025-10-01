import React from "react";

interface AggregateProgressDisplayProps {
  processedFiles: number;
  totalFiles: number;
}

const AggregateProgressDisplay: React.FC<AggregateProgressDisplayProps> = ({
  processedFiles,
  totalFiles,
}) => {
  const percentage =
    totalFiles > 0 ? Math.round((processedFiles / totalFiles) * 100) : 0;

  return (
    <div className="mt-4 p-4 bg-gray-100 rounded-lg shadow-inner">
      <h4 className="font-semibold text-black mb-2">S3 Upload Progress</h4>
      <div className="w-full bg-gray-300 rounded-full h-6">
        <div
          className="bg-black h-6 rounded-full text-lg font-medium text-white text-center leading-6"
          style={{ width: `${percentage}%` }}
        >
          {percentage}%
        </div>
      </div>
      <div className="text-center mt-2 font-mono text-black">
        {processedFiles.toLocaleString()} / {totalFiles.toLocaleString()} files
        uploaded
      </div>
    </div>
  );
};

export default AggregateProgressDisplay;
