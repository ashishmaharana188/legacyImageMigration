import { useState } from "react";
import { transferDataFromPostgresService } from "./mongoTaskService";
import { useTaskLog } from "../../contexts/TaskLogContext";

export const useMongoTask = () => {
  const [loading, setLoading] = useState(false);
    const [clientCode, setClientCode] = useState("");
    const [useCsv, setUseCsv] = useState(true);
  const { updateTaskLog } = useTaskLog();

  // [CLEANUP] Removed updateAllMongo state and handleUpdateMongoTransactions

  const handleTransferToMongo = async (code: string) => {
    setLoading(true);
    const target = code || "ALL";

    updateTaskLog("imageDataTransfer", {
      id: "LIVE_MONGO_PROGRESS",
      status: "Running",
      message: `Starting PG -> Mongo Transfer (Client: ${target})...`,
      progress: 0,
    });

    try {
      const data = await transferDataFromPostgresService(code,useCsv);
      // Success is mostly handled via WebSocket, but we log the final response here
      console.log("Transfer Initiated", data);
    } catch (err: any) {
      updateTaskLog("imageDataTransfer", {
        id: "LIVE_MONGO_PROGRESS",
        status: "Error",
        message: err.message || "Transfer Failed",
        errors: 1,
      });
    } finally {
      setLoading(false);
    }
  };

  return {
      loading,
      useCsv,
    clientCode,
    setClientCode,
    handleTransferToMongo,
  };
};
