import React, { useCallback, useState } from "react";
import axios from "axios";
import SanityCheckUI from "../ui/SanityCheckUI";
import dayjs from "dayjs";

interface SanityCheckTaskProps {
  updateTaskLog: (task: string, log: any) => void;
  clearTaskLog: (task: string) => void;
}

const SanityCheckTask: React.FC<SanityCheckTaskProps> = ({
  updateTaskLog,
  clearTaskLog,
}) => {
  const [isDeleteEnabled, setIsDeleteEnabled] = useState(false);
  const [isMongoDeleteEnabled, setIsMongoDeleteEnabled] = useState(false);
  const [normalize, setNormalize] = useState(false);
  const [cutoffDate, setCutoffDate] = useState<dayjs.Dayjs | null>(
    dayjs("2025-09-05")
  );
  const [clientCode, setClientCode] = useState("");
  const [isLoadingPg, setIsLoadingPg] = useState(false);
  const [isLoadingMongo, setIsLoadingMongo] = useState(false);
  const [duplicateMongoCheckResult, setDuplicateMongoCheckResult] = useState<
    any | null
  >(null);

  const handlePgSanityCheck = useCallback(
    async (dryRun: boolean) => {
      if (!cutoffDate) {
        updateTaskLog("pgSanityCheck", {
          message: "Please select a cutoff date.",
        });
        return;
      }
      clearTaskLog("pgSanityCheck");
      updateTaskLog("pgSanityCheck", "PostgreSQL Duplicate Check in Progress");
      setIsLoadingPg(true);

      const cutoffTms = `${cutoffDate.format("YYYY-MM-DD")}T00:00:00.0000`;
      console.log("Frontend sending cutoffTms for PG:", cutoffTms);

      try {
        const res = await axios.post(
          "http://localhost:3000/sql/sanity-check-duplicates",
          {
            dryRun,
            normalize,
            cutoffTms,
            clientCode,
          }
        );
        updateTaskLog("pgSanityCheck", res.data);
      } catch (error: unknown) {
        const axiosError = error as any;
        const errorMessage =
          axiosError.response?.data?.error || "An unknown error occurred.";
        updateTaskLog("pgSanityCheck", {
          message: `PostgreSQL sanity check failed: ${errorMessage}`,
        });
      } finally {
        setIsLoadingPg(false);
      }
    },
    [normalize, cutoffDate, clientCode, updateTaskLog, clearTaskLog]
  );

  const handleMongoSanityCheck = useCallback(
    async (dryRun: boolean) => {
      if (!cutoffDate) {
        updateTaskLog("mongoSanityCheck", {
          message: "Please select a cutoff date.",
        });
        return;
      }
      clearTaskLog("mongoSanityCheck");
      updateTaskLog("mongoSanityCheck", "MongoDB Duplicate Check in Progress");
      setIsLoadingMongo(true);
      setDuplicateMongoCheckResult(null); // Clear previous result

      const cutoffTms = cutoffDate.format("M/D/YYYY"); // Format as M/D/YYYY for regex matching
      console.log("Frontend sending cutoffTms for Mongo:", cutoffTms);

      try {
        const mongoRes = await axios.post(
          "http://localhost:3000/mongo/sanity-check-duplicates",
          {
            dryRun,
            cutoffTms,
            clientCode,
          }
        );
        setDuplicateMongoCheckResult(mongoRes.data);
        updateTaskLog("mongoSanityCheck", mongoRes.data);
      } catch (error: unknown) {
        const axiosError = error as any;
        const errorMessage =
          axiosError.response?.data?.error || "An unknown error occurred.";
        updateTaskLog("mongoSanityCheck", {
          message: `MongoDB sanity check failed: ${errorMessage}`,
        });
        setDuplicateMongoCheckResult({
          message: `Mongo check failed: ${errorMessage}`,
        });
      } finally {
        setIsLoadingMongo(false);
      }
    },
    [cutoffDate, clientCode, updateTaskLog, clearTaskLog]
  );

  return (
    <SanityCheckUI
      handlePgSanityCheck={handlePgSanityCheck}
      handleMongoSanityCheck={handleMongoSanityCheck}
      isDeleteEnabled={isDeleteEnabled}
      setIsDeleteEnabled={setIsDeleteEnabled}
      normalize={normalize}
      setNormalize={setNormalize}
      cutoffDate={cutoffDate}
      setCutoffDate={setCutoffDate}
      clientCode={clientCode}
      setClientCode={setClientCode}
      isLoadingPg={isLoadingPg}
      isLoadingMongo={isLoadingMongo}
      duplicateMongoCheckResult={duplicateMongoCheckResult}
      isMongoDeleteEnabled={isMongoDeleteEnabled}
      setIsMongoDeleteEnabled={setIsMongoDeleteEnabled}
    />
  );
};

export default SanityCheckTask;
