import React from "react";
import { SplitProcessorSummaryUIProps } from "./splitProcessorType";

// --- 1. RIGHT SIDE PANEL (DISABLED) ---
// We return null here to completely hide the logs on the right side
const SplitProcessorSummaryUI: React.FC<SplitProcessorSummaryUIProps> = () => {
  return null;
};

export default SplitProcessorSummaryUI;

// --- 2. SIDEBAR PROGRESS BAR (KEPT ACTIVE) ---
// This is used by your Global Summary Display (Left/Sidebar)
interface SplitProcessDisplayProps {
  title: string;
  progress: number;
  total: number;
  successful: number;
  errors: number;
}

export const SplitProcessDisplay: React.FC<SplitProcessDisplayProps> = ({
  title,
  progress,
  total,
  successful,
  errors,
}) => {
  return (
    <div className="p-4 bg-gray-100 rounded-lg shadow-inner mb-4 border border-gray-200">
      <h4 className="font-semibold text-black mb-2">{title}</h4>

      {/* Black Progress Bar */}
      <div className="w-full bg-gray-300 rounded-full h-4 mb-2">
        <div
          className="bg-black h-4 rounded-full text-xs font-medium text-white text-center p-0.5 leading-none transition-all duration-500"
          style={{ width: `${Math.round(progress)}%` }}
        >
          {Math.round(progress)}%
        </div>
      </div>

      {/* Stats Grid */}
      <div className="text-sm grid grid-cols-2 gap-2 mt-2">
        <div>
          <span className="text-gray-600 font-medium">Total Pages: </span>
          <span className="font-bold text-gray-900">{total}</span>
        </div>
        <div>
          <span className="text-gray-600 font-medium">Generated: </span>
          <span className="font-bold text-green-700">{successful}</span>
        </div>
        <div>
          <span className="text-gray-600 font-medium">Errors: </span>
          <span className="font-bold text-red-600">{errors}</span>
        </div>
      </div>
    </div>
  );
};
