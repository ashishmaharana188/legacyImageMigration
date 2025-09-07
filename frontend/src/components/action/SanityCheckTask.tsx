import React, { useCallback } from "react";
import axios, { AxiosError } from "axios";
import SanityCheckUI from "../ui/SanityCheckUI";

interface SanityCheckTaskProps {
  setLogs: React.Dispatch<
    React.SetStateAction<{ status: string; errors: string[] }>
  >;
  setSanityCheckResult: React.Dispatch<React.SetStateAction<unknown>>;
}

const SanityCheckTask: React.FC<SanityCheckTaskProps> = ({
  setLogs,
  setSanityCheckResult,
}) => {
  const handleSanityCheck = useCallback(async () => {
    setLogs({ status: "Performing sanity check...", errors: [] });
    try {
      const res = await axios.get("http://localhost:3001/sanity-check");
      setSanityCheckResult(res.data);
      setLogs((prev) => ({
        ...prev,
        status: res.data.message || "Sanity check successful!",
      }));
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setLogs((prev) => ({
          ...prev,
          status: "Sanity check failed.",
          errors: [
            ...prev.errors,
            error.response?.data?.error || "An unknown error occurred.",
          ],
        }));
        setSanityCheckResult(error.response?.data || null);
      } else {
        setLogs((prev) => ({
          ...prev,
          status: "Sanity check failed.",
          errors: [...prev.errors, "An unknown error occurred."],
        }));
        setSanityCheckResult(null);
      }
    }
  }, [setLogs, setSanityCheckResult]);

  return <SanityCheckUI handleSanityCheck={handleSanityCheck} />;
};

export default SanityCheckTask;
