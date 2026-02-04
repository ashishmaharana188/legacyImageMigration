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

  // [STANDARD] WebSocket Listener
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === "sanity-progress") {
        updateTaskLog(message.task, {
          id: "LIVE_SANITY_PROGRESS",
          status: message.status,
          message: message.message,
          progress: message.progress,
          metrics: message.metrics, // WebSocket provides the correct metrics structure
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
          status: "Error",
          message: "Date required",
        });
        return;
      }

      clearTaskLog("pgSanityCheck");
      setIsLoadingPg(true);

      // Initial State
      updateTaskLog("pgSanityCheck", {
        id: "LIVE_SANITY_PROGRESS",
        status: "Running",
        message: "Requesting SQL Check...",
        progress: 0,
        metrics: {},
      });

      const cutoffTms = `${cutoffDate.format("YYYY-MM-DD")}T00:00:00.0000`;

      try {
        // [FIX] Fire request but DO NOT overwrite log with response
        await axios.post("http://localhost:3000/sql/sanity-check-duplicates", {
          dryRun,
          normalize,
          cutoffTms,
          clientCode,
        });
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

      // Initial State
      updateTaskLog("mongoSanityCheck", {
        id: "LIVE_SANITY_PROGRESS",
        status: "Running",
        message: "Requesting Mongo Check...",
        progress: 0,
        metrics: {},
      });

      const cutoffTms = cutoffDate.format("M/D/YYYY");

      try {
        // [FIX] Fire request but DO NOT overwrite log with response
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
