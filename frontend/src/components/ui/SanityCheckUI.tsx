import React from "react";
import dayjs from "dayjs";

interface SanityCheckUIProps {
  handleSanityCheck: (dryRun: boolean) => Promise<void>;
  isDeleteEnabled: boolean;
  setIsDeleteEnabled: (value: boolean) => void;
  normalize: boolean;
  setNormalize: (value: boolean) => void;
  cutoffDate: dayjs.Dayjs | null;
  setCutoffDate: (value: dayjs.Dayjs | null) => void;
  isLoading: boolean;
}

const SanityCheckUI: React.FC<SanityCheckUIProps> = ({
  handleSanityCheck,
  isDeleteEnabled,
  setIsDeleteEnabled,
  normalize,
  setNormalize,
  cutoffDate,
  setCutoffDate,
  isLoading,
}) => {
  return (
    <div className="p-4 mt-2 border rounded">
      <h3 className="text-xl font-bold text-black mb-4">Sanity Check for Duplicates</h3>
      <div className="flex flex-col gap-4">
        <input
          type="date"
          value={cutoffDate ? cutoffDate.format("YYYY-MM-DD") : ""}
          onChange={(e) => setCutoffDate(dayjs(e.target.value))}
          disabled={isLoading}
          className="p-2 border rounded"
        />
        <label>
          <input
            type="checkbox"
            checked={normalize}
            onChange={(e) => setNormalize(e.target.checked)}
            disabled={isLoading}
          />
          <span className="ml-2">Normalize (trim and lowercase) keys for comparison</span>
        </label>
        <button
          onClick={() => handleSanityCheck(true)}
          disabled={isLoading}
          className="btn"
        >
          {isLoading ? "Checking..." : "Find Duplicate Rows (Dry Run)"}
        </button>
        <label>
          <input
            type="checkbox"
            checked={isDeleteEnabled}
            onChange={(e) => setIsDeleteEnabled(e.target.checked)}
            disabled={isLoading}
          />
          <span className="ml-2">Enable Deletion Mode</span>
        </label>
        {isDeleteEnabled && (
          <button
            onClick={() => handleSanityCheck(false)}
            disabled={isLoading}
            className="btn-danger"
          >
            {isLoading ? "Deleting..." : "Delete Found Duplicates"}
          </button>
        )}
      </div>
    </div>
  );
};

export default SanityCheckUI;
