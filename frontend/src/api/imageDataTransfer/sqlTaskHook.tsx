import { useState, useCallback } from "react";
import {
  executeSqlService,
  updateFolioAndTransactionService,
  reconnectDbService,
} from "./sqlTaskService";
import { useTaskLog } from "../../contexts/TaskLogContext";

export const useSqlTask = () => {
  const [loading, setLoading] = useState(false);
  const [updateAll, setUpdateAll] = useState(false);
  const { updateTaskLog } = useTaskLog();

  const handleExecuteSql = useCallback(async () => {
    setLoading(true);
    // Initial Log
    updateTaskLog("imageDataTransfer", {
      id: "LIVE_SQL_PROGRESS",
      status: "Running",
      message: "Requesting Start...",
      progress: 0,
    });
    try {
      await executeSqlService();
      // Don't log success here; WebSocket will do it
    } catch (err: any) {
      updateTaskLog("imageDataTransfer", {
        id: "LIVE_SQL_PROGRESS",
        status: "Error",
        message: "Start Failed",
      });
    } finally {
      setLoading(false); // Button becomes clickable again immediately? Or keep disabled?
      // Usually keep disabled until WS says complete, but for now let's re-enable to allow retries.
    }
  }, [updateTaskLog]);

  const handleUpdateFolioAndTransaction = useCallback(
    async (isUpdateAll: boolean) => {
      setLoading(true);
      updateTaskLog("imageDataTransfer", {
        id: "LIVE_SQL_PROGRESS",
        status: "Running",
        message: "Requesting Update...",
        progress: 0,
      });
      try {
        await updateFolioAndTransactionService(isUpdateAll, [], []);
      } catch (err: any) {
        updateTaskLog("imageDataTransfer", {
          id: "LIVE_SQL_PROGRESS",
          status: "Error",
          message: "Start Failed",
        });
      } finally {
        setLoading(false);
      }
    },
    [updateTaskLog]
  );

  const handleReconnect = useCallback(async () => {
    // Reconnect is fast, can stay HTTP
    setLoading(true);
    try {
      await reconnectDbService();
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    handleExecuteSql,
    handleUpdateFolioAndTransaction,
    handleReconnect,
    updateAll,
    setUpdateAll,
  };
};
