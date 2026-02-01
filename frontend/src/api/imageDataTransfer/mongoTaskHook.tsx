import { useState } from "react";
import {
  transferDataFromPostgresService,
  updateMongoTransactionsService,
} from "./mongoTaskService";
import { useTaskLog } from "../../contexts/TaskLogContext";

export const useMongoTask = () => {
  const [loading, setLoading] = useState(false);
  // [FIX] Added state required by UI
  const [clientCode, setClientCode] = useState("");
  const [updateAllMongo, setUpdateAllMongo] = useState(false);

  const { updateTaskLog } = useTaskLog();

  const handleTransferData = async (code?: string) => {
    setLoading(true);
    const target = code || "ALL";
    updateTaskLog("imageDataTransfer", {
      id: `MONGO_TRANSFER_${Date.now()}`,
      status: "Running",
      message: `Starting PG -> Mongo Transfer (Client: ${target})...`,
      timestamp: new Date().toISOString(),
    });

    try {
      const data = await transferDataFromPostgresService(code);
      updateTaskLog("imageDataTransfer", {
        id: `MONGO_TRANSFER_DONE_${Date.now()}`,
        status: "Success",
        message: `Transfer Complete. Documents Transferred: ${data.transferredCount}`,
        timestamp: new Date().toISOString(),
        successfulRows: data.transferredCount,
      });
    } catch (err: any) {
      updateTaskLog("imageDataTransfer", {
        id: `MONGO_TRANSFER_ERR_${Date.now()}`,
        status: "Error",
        message: err.message || "Transfer Failed",
        timestamp: new Date().toISOString(),
        errors: 1,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMongoTransactions = async (clientId?: number) => {
    setLoading(true);
    updateTaskLog("imageDataTransfer", {
      id: `MONGO_SYNC_${Date.now()}`,
      status: "Running",
      message: `Starting Mongo Transaction Sync (Client ID: ${
        clientId || "All"
      })...`,
      timestamp: new Date().toISOString(),
    });

    try {
      const data = await updateMongoTransactionsService(clientId);
      updateTaskLog("imageDataTransfer", {
        id: `MONGO_SYNC_DONE_${Date.now()}`,
        status: "Success",
        message: `Sync Complete. Updated: ${data.updatedCount}, Synced: ${data.syncedCount}`,
        timestamp: new Date().toISOString(),
        successfulRows: data.updatedCount + data.syncedCount,
      });
    } catch (err: any) {
      updateTaskLog("imageDataTransfer", {
        id: `MONGO_SYNC_ERR_${Date.now()}`,
        status: "Error",
        message: err.message || "Sync Failed",
        timestamp: new Date().toISOString(),
        errors: 1,
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    clientCode,
    setClientCode,
    updateAllMongo,
    setUpdateAllMongo,
    handleTransferData,
    handleUpdateMongoTransactions,
  };
};
