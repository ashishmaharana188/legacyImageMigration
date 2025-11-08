import { useState, useCallback } from "react";
import axios from "axios";
import { generateSql, executeSql, updateFolioAndTransaction, reconnectDb } from "./sqlTaskService";
import { UseSQLTaskHookProps } from "./sqlTaskType";

export const useSQLTaskHook = ({ updateTaskLog, clearTaskLog }: UseSQLTaskHookProps) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [updateAll, setUpdateAll] = useState<boolean>(false);

  const handleGenerateSql = useCallback(async () => {
    setLoading(true);
    clearTaskLog("sqlAndMongo");
    updateTaskLog("sqlAndMongo", { message: "Generating SQL" });
    try {
      const res = await generateSql();
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

  const handleExecuteSql = useCallback(async () => {
    setLoading(true);
    clearTaskLog("sqlAndMongo");
    updateTaskLog("sqlAndMongo", { message: "Executing SQL" });
    try {
      const res = await executeSql();
      const { totalRows = 0, successfulRows = 0, badRows = 0, message: resMessage, ...restData } = res;

      let finalMessage = resMessage || "SQL execution completed.";
      let finalStatus: "success" | "failed" = "success";

      if (badRows > 0) {
        finalMessage = `SQL execution completed: ${successfulRows} Successful, ${badRows} Failed out of ${totalRows} rows.`;
        finalStatus = "failed";
      } else if (totalRows > 0) {
        finalMessage = `SQL executed successfully. Total rows: ${totalRows}, Successful: ${successfulRows}.`;
        finalStatus = "success";
      } else {
        finalMessage = resMessage || "No rows processed during SQL execution.";
        finalStatus = "success";
      }

      updateTaskLog("sqlAndMongo", {
        message: finalMessage,
        status: finalStatus,
        totalRows: totalRows,
        successfulRows: successfulRows,
        badRows: badRows,
        ...restData,
      });
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

  const handleUpdateFolioAndTransaction = useCallback(async (updateAll: boolean) => {
    setLoading(true);
    clearTaskLog("sqlAndMongo");
    updateTaskLog("sqlAndMongo", { message: "Updating folio and transaction" });
    try {
      const res = await updateFolioAndTransaction(updateAll);
      const { updatedFolioRows = 0, updatedTransactionRows = 0, badRows = 0, message: resMessage, ...restData } = res;

      let finalMessage = resMessage || "Folio and Transaction update completed.";
      let finalStatus: "success" | "failed" = "success";

      if (badRows > 0) {
        finalMessage = `Folio and Transaction update completed: Folio Rows Updated: ${updatedFolioRows}, Transaction Rows Updated: ${updatedTransactionRows}, Bad Rows: ${badRows}.`;
        finalStatus = "failed";
      } else if (updatedFolioRows > 0 || updatedTransactionRows > 0) {
        finalMessage = `Folio and Transaction updated successfully. Folio Rows: ${updatedFolioRows}, Transaction Rows: ${updatedTransactionRows}.`;
        finalStatus = "success";
      } else {
        finalMessage = resMessage || "No Folio or Transaction rows updated.";
        finalStatus = "success";
      }

      updateTaskLog("sqlAndMongo", {
        message: finalMessage,
        status: finalStatus,
        updatedFolioRows: updatedFolioRows,
        updatedTransactionRows: updatedTransactionRows,
        badRows: badRows,
        ...restData,
      });
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

  const handleReconnect = useCallback(async () => {
    setLoading(true);
    clearTaskLog("sqlAndMongo");
    updateTaskLog("sqlAndMongo", { message: "Reconnecting to the database" });
    try {
      const res = await reconnectDb();
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
    handleGenerateSql,
    handleExecuteSql,
    handleUpdateFolioAndTransaction,
    handleReconnect,
    updateAll,
    setUpdateAll,
  };
};
