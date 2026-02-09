import { useState, useCallback } from "react";
import {
  executeSqlService,
  updateFolioAndTransactionService,
  reconnectDbService,
} from "./sqlTaskService";
import { useTaskLog } from "../../contexts/TaskLogContext";

export const useSqlTask = () => {
  const [loading, setLoading] = useState(false);
  // [NEW] State for Update Mode (false = Specific/CSV, true = Global/All)
  const [isUpdateAll, setIsUpdateAll] = useState(false);

  const { updateTaskLog } = useTaskLog();

  const handleExecuteSql = useCallback(async () => {
    setLoading(true);
    updateTaskLog("imageDataTransfer", {
      id: "LIVE_SQL_PROGRESS",
      status: "Running",
      message: "Requesting SQL Execution...",
      progress: 0,
    });
    try {
      await executeSqlService();
    } catch (err: any) {
      updateTaskLog("imageDataTransfer", {
        id: "LIVE_SQL_PROGRESS",
        status: "Error",
        message: err.message || "Execution Failed",
      });
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog]);

  const handleUpdateFolioAndTransaction = useCallback(async () => {
    setLoading(true);

    const modeMsg = isUpdateAll
      ? "GLOBAL UPDATE (All Records)"
      : "SPECIFIC UPDATE (From CSV)";

    updateTaskLog("imageDataTransfer", {
      id: "LIVE_SQL_PROGRESS",
      status: "Running",
      message: `Requesting ${modeMsg}...`,
      progress: 0,
    });

    try {
      // [UPDATED] Pass the toggle state to the service
      await updateFolioAndTransactionService(isUpdateAll);
    } catch (err: any) {
      updateTaskLog("imageDataTransfer", {
        id: "LIVE_SQL_PROGRESS",
        status: "Error",
        message: err.message || "Update Start Failed",
      });
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog, isUpdateAll]);

  const handleReconnect = useCallback(async () => {
    setLoading(true);
    try {
      await reconnectDbService();
    } catch (e) {
      // Silent catch
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    handleExecuteSql,
    handleUpdateFolioAndTransaction,
    handleReconnect,
    // [NEW] Export toggle state
    isUpdateAll,
    setIsUpdateAll,
  };
};
