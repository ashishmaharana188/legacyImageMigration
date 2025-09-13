import React, { useCallback, useState } from "react";
import axios from "axios";
import SanityCheckUI from "../ui/SanityCheckUI";
import dayjs from "dayjs";

interface SanityCheckTaskProps {
  setLogs: React.Dispatch<
    React.SetStateAction<{ status: string; errors: string[] }>
  >;
  setSanityCheckResult: React.Dispatch<React.SetStateAction<any>>;
  updateTaskLog: (task: string, log: any) => void;
}

const SanityCheckTask: React.FC<SanityCheckTaskProps> = ({
  setLogs,
  setSanityCheckResult,
  updateTaskLog,
}) => {
  const [isDeleteEnabled, setIsDeleteEnabled] = useState(false);
  const [normalize, setNormalize] = useState(false);
  const [cutoffDate, setCutoffDate] = useState<dayjs.Dayjs | null>(
    dayjs("2025-09-05")
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleSanityCheck = useCallback(
    async (dryRun: boolean) => {
      if (!cutoffDate) {
        updateTaskLog('sanityCheck', "Please select a cutoff date.");
        return;
      }

      const action = dryRun ? "Finding" : "Deleting";
      updateTaskLog('sanityCheck', `${action} duplicates...`);
      setIsLoading(true);
      setSanityCheckResult(null);

      // Format the date to YYYY-MM-DD and append T00:00:00.0000
      const cutoffTms = `${cutoffDate.format("YYYY-MM-DD")}T00:00:00.0000`;
      console.log("Frontend sending cutoffTms:", cutoffTms);

      try {
        const res = await axios.post(
          "http://localhost:3000/sanity-check-duplicates",
          {
            dryRun,
            normalize,
            cutoffTms,
          }
        );
        setSanityCheckResult(res.data);
        if (dryRun) {
          updateTaskLog('sanityCheck', `Found ${res.data.rows?.length || 0} potential duplicates.`);
        } else {
          updateTaskLog('sanityCheck', `Successfully deleted ${res.data.deletedCount || 0} rows.`);
        }
      } catch (error: unknown) {
        const axiosError = error as any;
        const errorMessage =
          axiosError.response?.data?.error || "An unknown error occurred.";
        updateTaskLog('sanityCheck', `Sanity check failed: ${errorMessage}`);
        setSanityCheckResult(axiosError.response?.data || null);
      } finally {
        setIsLoading(false);
      }
    },
    [normalize, cutoffDate, setSanityCheckResult, updateTaskLog]
  );

  return (
    <SanityCheckUI
      handleSanityCheck={handleSanityCheck}
      isDeleteEnabled={isDeleteEnabled}
      setIsDeleteEnabled={setIsDeleteEnabled}
      normalize={normalize}
      setNormalize={setNormalize}
      cutoffDate={cutoffDate}
      setCutoffDate={setCutoffDate}
      isLoading={isLoading}
    />
  );
};

export default SanityCheckTask;
