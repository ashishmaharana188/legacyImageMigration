import React from "react";
import { SplitFile } from "./splitProcessorType";

interface SplitProcessorSummaryUIProps {
  splitMessage: string;
  splitFiles: SplitFile[];
}

const SplitProcessorSummaryUI: React.FC<SplitProcessorSummaryUIProps> = ({
  splitMessage,
  splitFiles,
}) => {
  if (!splitMessage && splitFiles.length === 0) {
    return null;
  }

  return (
    <div className="border border-gray-300 rounded-lg p-4 mt-4">
      <h4 className="font-semibold text-lg text-black mb-3">Split Results</h4>
      {splitMessage && (
        <p className="text-sm text-gray-600 mb-2">{splitMessage}</p>
      )}
      {splitFiles.length > 0 && (
        <div>
          <h5 className="font-medium text-md text-black mt-4 mb-2">
            Generated Files:
          </h5>
          <ul>
            {splitFiles.map((file, index) => (
              <li key={index} className="text-sm text-gray-700">
                Row: {file.row}, Page Count: {file.pageCount}, URL:{" "}
                <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                  {file.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SplitProcessorSummaryUI;
