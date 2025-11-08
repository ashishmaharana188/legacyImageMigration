import { useState, useCallback } from "react";
import axios from "axios";
import { transferToMongo } from "./mongoTaskService";
import { UseMongoTaskHookProps } from "./mongoTaskType";

export const useMongoTaskHook = ({ updateTaskLog, clearTaskLog }: UseMongoTaskHookProps) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [clientCode, setClientCode] = useState<string>('');
  const [updateAllMongo, setUpdateAllMongo] = useState<boolean>(false);

  const handleTransferToMongo = useCallback(async (updateAll: boolean, clientCode: string) => {
    setLoading(true);
    clearTaskLog("sqlAndMongo");
    const taskMessage = updateAll ? "Updating Mongo transactions" : "Transferring data to MongoDB";
    updateTaskLog("sqlAndMongo", { message: taskMessage });
    
    try {
      const res = await transferToMongo(updateAll, clientCode);
      updateTaskLog("sqlAndMongo", res);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog("sqlAndMongo", error.response?.data || { message: "An unknown error occurred." });
      } else {
        updateTaskLog("sqlAndMongo", { message: "An unknown error occurred." });
      }
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog, clearTaskLog]);

  return {
    loading,
    clientCode,
    setClientCode,
    updateAllMongo,
    setUpdateAllMongo,
    handleTransferToMongo,
  };
};
