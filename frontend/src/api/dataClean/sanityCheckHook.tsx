import { useState, useCallback } from "react";
import axios from "axios";
import dayjs from "dayjs";
import { UseSanityCheckHookProps, SanityCheckResponse } from "./sanityCheckType";
import { sanityCheckPgDuplicates, sanityCheckMongoDuplicates } from "./sanityCheckService";

export const useSanityCheckHook = ({ updateTaskLog, clearTaskLog }: UseSanityCheckHookProps) => {
  const [isDeleteEnabled, setIsDeleteEnabled] = useState(false);
  const [isMongoDeleteEnabled, setIsMongoDeleteEnabled] = useState(false);
  const [normalize, setNormalize] = useState(false);
  const [cutoffDate, setCutoffDate] = useState<dayjs.Dayjs | null>(
    dayjs("2025-09-05")
  );
  const [clientCode, setClientCode] = useState("");
  const [isLoadingPg, setIsLoadingPg] = useState(false);
  const [isLoadingMongo, setIsLoadingMongo] = useState(false);
  const [duplicateMongoCheckResult, setDuplicateMongoCheckResult] = useState<SanityCheckResponse | null>(null);

  const handlePgSanityCheck = useCallback(
    async (dryRun: boolean) => {
      if (!cutoffDate) {
        updateTaskLog("pgSanityCheck", {
          message: "Please select a cutoff date.",
          status: "failed",
        });
        return;
      }
      clearTaskLog("pgSanityCheck");
      updateTaskLog("pgSanityCheck", { message: "PostgreSQL Duplicate Check in Progress", status: "in-progress" });
      setIsLoadingPg(true);

      const cutoffTms = `${cutoffDate.format("YYYY-MM-DD")}T00:00:00.0000`;
      console.log("Frontend sending cutoffTms for PG:", cutoffTms);

      try {
        const res = await sanityCheckPgDuplicates(dryRun, normalize, cutoffTms, clientCode);
        updateTaskLog("pgSanityCheck", { ...res, status: res.error ? "failed" : "success" });
      } catch (error: unknown) {
        let errorMessage = "An unknown error occurred.";
        if (axios.isAxiosError(error)) {
          errorMessage = error.response?.data?.error || error.message;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        updateTaskLog("pgSanityCheck", {
          message: `PostgreSQL sanity check failed: ${errorMessage}`,
          status: "failed",
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
          status: "failed",
        });
        return;
      }
      clearTaskLog("mongoSanityCheck");
      updateTaskLog("mongoSanityCheck", { message: "MongoDB Duplicate Check in Progress", status: "in-progress" });
      setIsLoadingMongo(true);
      setDuplicateMongoCheckResult(null); // Clear previous result

      const cutoffTms = cutoffDate.format("M/D/YYYY"); // Format as M/D/YYYY for regex matching
      console.log("Frontend sending cutoffTms for Mongo:", cutoffTms);

      try {
        const mongoRes = await sanityCheckMongoDuplicates(dryRun, cutoffTms, clientCode);
        setDuplicateMongoCheckResult(mongoRes);
        updateTaskLog("mongoSanityCheck", { ...mongoRes, status: mongoRes.error ? "failed" : "success" });
      } catch (error: unknown) {
        let errorMessage = "An unknown error occurred.";
        if (axios.isAxiosError(error)) {
          errorMessage = error.response?.data?.error || error.message;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        updateTaskLog("mongoSanityCheck", {
          message: `MongoDB sanity check failed: ${errorMessage}`,
          status: "failed",
        });
        setDuplicateMongoCheckResult({ message: `Mongo check failed: ${errorMessage}`, status: "failed" });
      } finally {
        setIsLoadingMongo(false);
      }
    },
    [cutoffDate, clientCode, updateTaskLog, clearTaskLog]
  );

  return {
    isDeleteEnabled,
    setIsDeleteEnabled,
    isMongoDeleteEnabled,
    setIsMongoDeleteEnabled,
    normalize,
    setNormalize,
    cutoffDate,
    setCutoffDate,
    clientCode,
    setClientCode,
    isLoadingPg,
    isLoadingMongo,
    duplicateMongoCheckResult,
    handlePgSanityCheck,
    handleMongoSanityCheck,
  };
};
