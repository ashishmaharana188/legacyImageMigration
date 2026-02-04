// frontend/src/components/action/SanityCheckTask.tsx

import React, { useCallback, useState, useEffect } from "react";
import axios from "axios";
import SanityCheckSummaryDisplay from "../../api/dataClean/sanityCheckSummaryUI";
import dayjs from "dayjs";
import { webSocketService } from "../../services/webSocketService";

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

  // [FIX] WebSocket Listener - Bridges Backend to Frontend UI
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === "sanity-progress") {
        updateTaskLog(message.task, {
          // [KEY] This ID must match what ProgressTrackingTask looks for
          id: "LIVE_SANITY_PROGRESS",
          status: message.status,
          message: message.message,
          progress: message.progress,
          metrics: message.metrics, // Capture metrics from backend wrapper
          totalDuplicates: message.totalDuplicates,
        });

        if (message.status !== "Running") {
          if (message.task === "pgSanityCheck") setIsLoadingPg(false);
          if (message.task === "mongoSanityCheck") setIsLoadingMongo(false);
        }
      }
    };

    webSocketService.addListener(handleMessage);
    return () => webSocketService.removeListener(handleMessage);
  }, [updateTaskLog]);

  const handlePgSanityCheck = useCallback(
    async (dryRun: boolean) => {
      if (!cutoffDate) {
        updateTaskLog("pgSanityCheck", {
          id: "LIVE_SANITY_PROGRESS",
          status: "Error",
          message: "Date required",
        });
        return;
      }

      clearTaskLog("pgSanityCheck");
      setIsLoadingPg(true);

      // 1. Initialize Log immediately so sidebar shows "Requesting..."
      updateTaskLog("pgSanityCheck", {
        id: "LIVE_SANITY_PROGRESS",
        status: "Running",
        message: "Requesting SQL Check...",
        progress: 0,
        metrics: {},
      });

      const cutoffTms = `${cutoffDate.format("YYYY-MM-DD")}T00:00:00.0000`;

      try {
        // 2. Fire and Forget request
        await axios.post("http://localhost:3000/sql/sanity-check-duplicates", {
          dryRun,
          normalize,
          cutoffTms,
          clientCode,
        });
        // Do not await result; WebSocket handles the rest.
      } catch (error: any) {
        setIsLoadingPg(false);
        updateTaskLog("pgSanityCheck", {
          id: "LIVE_SANITY_PROGRESS",
          status: "Error",
          message: "Request Failed",
        });
      }
    },
    [normalize, cutoffDate, clientCode, updateTaskLog, clearTaskLog]
  );

  const handleMongoSanityCheck = useCallback(
    async (dryRun: boolean) => {
      if (!cutoffDate) return;
      clearTaskLog("mongoSanityCheck");
      setIsLoadingMongo(true);

      updateTaskLog("mongoSanityCheck", {
        id: "LIVE_SANITY_PROGRESS",
        status: "Running",
        message: "Requesting Mongo Check...",
        progress: 0,
        metrics: {},
      });

      const cutoffTms = cutoffDate.format("M/D/YYYY");

      try {
        await axios.post(
          "http://localhost:3000/mongo/sanity-check-duplicates",
          {
            dryRun,
            cutoffTms,
            clientCode,
          }
        );
      } catch (error: any) {
        setIsLoadingMongo(false);
        updateTaskLog("mongoSanityCheck", {
          id: "LIVE_SANITY_PROGRESS",
          status: "Error",
          message: "Request Failed",
        });
      }
    },
    [cutoffDate, clientCode, updateTaskLog, clearTaskLog]
  );

  return (
    <SanityCheckSummaryDisplay
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
      isMongoDeleteEnabled={isMongoDeleteEnabled}
      setIsMongoDeleteEnabled={setIsMongoDeleteEnabled}
    />
  );
};

export default SanityCheckTask;
