import React, { useCallback, useState } from "react";
import axios from "axios";
import SanityCheckUI from "../ui/SanityCheckUI";
import dayjs from "dayjs";

interface SanityCheckTaskProps {
  updateTaskLog: (task: string, log: any) => void;
}

const SanityCheckTask: React.FC<SanityCheckTaskProps> = ({
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
        updateTaskLog('sanityCheck', { message: "Please select a cutoff date." });
        return;
      }

      const action = dryRun ? "Finding" : "Deleting";
      updateTaskLog('sanityCheck', { message: `${action} duplicates...` });
      setIsLoading(true);

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
        updateTaskLog('sanityCheck', res.data);
      } catch (error: unknown) {
        const axiosError = error as any;
        const errorMessage =
          axiosError.response?.data?.error || "An unknown error occurred.";
        updateTaskLog('sanityCheck', { message: `Sanity check failed: ${errorMessage}` });
      } finally {
        setIsLoading(false);
      }
    },
    [normalize, cutoffDate, updateTaskLog]
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
