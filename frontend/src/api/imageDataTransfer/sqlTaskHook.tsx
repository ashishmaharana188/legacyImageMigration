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
    updateTaskLog("imageDataTransfer", {
      id: `SQL_EXEC_${Date.now()}`,
      status: "Running",
      message: "Initiating SQL Execution...",
      timestamp: new Date().toISOString(),
    });
    try {
      const data = await executeSqlService();
      updateTaskLog("imageDataTransfer", {
        id: `SQL_EXEC_DONE_${Date.now()}`,
        status: "Success",
        message: `Insert Count: ${data.summary?.insertedRows ?? 0}`,
        timestamp: new Date().toISOString(),
        successfulRows: data.summary?.insertedRows,
        errors: data.summary?.errorRows,
      });
    } catch (err: any) {
      updateTaskLog("imageDataTransfer", {
        id: `SQL_EXEC_ERR_${Date.now()}`,
        status: "Error",
        message: err.message || "SQL Execution Failed",
        timestamp: new Date().toISOString(),
        errors: 1,
      });
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog]);

  const handleUpdateFolioAndTransaction = useCallback(
    async (isUpdateAll: boolean) => {
      setLoading(true);
      updateTaskLog("imageDataTransfer", {
        id: `UPDATE_FOLIO_${Date.now()}`,
        status: "Running",
        message: `Updating Folios (${isUpdateAll ? "ALL" : "Selective"})...`,
        timestamp: new Date().toISOString(),
      });
      try {
        const data = await updateFolioAndTransactionService(
          isUpdateAll,
          [],
          []
        );
        updateTaskLog("imageDataTransfer", {
          id: `UPDATE_FOLIO_DONE_${Date.now()}`,
          status: "Success",
          message: `Update Folios: ${
            data.summary?.updatedFolioRows ?? 0
          }, Update Txns: ${data.summary?.updatedTransactionRows ?? 0}`,
          timestamp: new Date().toISOString(),
          successfulRows:
            (data.summary?.updatedFolioRows ?? 0) +
            (data.summary?.updatedTransactionRows ?? 0),
        });
      } catch (err: any) {
        updateTaskLog("imageDataTransfer", {
          id: `UPDATE_FOLIO_ERR_${Date.now()}`,
          status: "Error",
          message: err.message || "Update Failed",
          timestamp: new Date().toISOString(),
          errors: 1,
        });
      } finally {
        setLoading(false);
      }
    },
    [updateTaskLog]
  );

  const handleReconnect = useCallback(async () => {
    setLoading(true);
    updateTaskLog("imageDataTransfer", {
      id: "DB_RECONN",
      status: "Running",
      message: "Reconnecting DB...",
      timestamp: new Date().toISOString(),
    });
    try {
      await reconnectDbService();
      updateTaskLog("imageDataTransfer", {
        id: "DB_RECONN_DONE",
        status: "Success",
        message: "Database Reconnected.",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      updateTaskLog("imageDataTransfer", {
        id: "DB_RECONN_ERR",
        status: "Error",
        message: "Reconnect Failed",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog]);

  return {
    loading,
    handleExecuteSql,
    handleUpdateFolioAndTransaction,
    handleReconnect,
    updateAll,
    setUpdateAll,
  };
};
