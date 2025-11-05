import React from "react";
import { SplitProcessorSummaryUIProps } from "./splitProcessorType";

const SplitProcessorSummaryUI: React.FC<SplitProcessorSummaryUIProps> = ({
  splitMessage,
  totalSplitFilesGenerated,
}) => {
  if (!splitMessage && totalSplitFilesGenerated === 0) {
    return null;
  }

  return (
    <div className="border border-gray-300 rounded-lg p-4 mt-4">
      <h4 className="font-semibold text-lg text-black mb-3">Split Results</h4>
      {splitMessage && (
        <p className="text-sm text-gray-600 mb-2">{splitMessage}</p>
      )}
      {totalSplitFilesGenerated > 0 && (
        <p className="text-sm text-gray-700">
          Total Split Files Generated: <strong>{totalSplitFilesGenerated}</strong>
        </p>
      )}
    </div>
  );
};

export default SplitProcessorSummaryUI;
