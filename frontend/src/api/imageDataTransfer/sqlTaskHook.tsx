import { useState, useCallback } from "react";
import axios from "axios";
import {
  generateSql,
  executeSql,
  updateFolioAndTransaction,
  reconnectDb,
} from "./sqlTaskService";
import { UseSQLTaskHookProps } from "./sqlTaskType";

export const useSQLTaskHook = ({
  updateTaskLog,
  clearTaskLog,
}: UseSQLTaskHookProps) => {
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
        updateTaskLog(
          "sqlAndMongo",
          error.response?.data || { message: "An unknown error occurred." }
        );
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

      // LOGICAL BRIDGE: Extracting from the nested 'summary' object provided by backend
      // We map 'insertedRows' to 'successfulRows' and 'errorRows' to 'badRows'
      const successfulRows =
        res.summary?.insertedRows ?? res.successfulRows ?? 0;
      const badRows = res.summary?.errorRows ?? res.badRows ?? 0;
      const totalRows = successfulRows + badRows;

      let finalMessage = res.message || "SQL execution completed.";
      let finalStatus: "success" | "failed" = "success";

      if (badRows > 0) {
        finalMessage = `SQL execution completed: ${successfulRows} Successful, ${badRows} Failed out of ${totalRows} rows.`;
        finalStatus = "failed";
      } else if (successfulRows > 0) {
        finalMessage = `SQL executed successfully. Total rows processed: ${totalRows}, Successful: ${successfulRows}.`;
        finalStatus = "success";
      } else {
        finalMessage = res.message || "No rows processed during SQL execution.";
        finalStatus = "success";
      }

      // We pass the mapped keys so SQLSummaryDisplay finds the data it expects
      updateTaskLog("sqlAndMongo", {
        ...res,
        message: finalMessage,
        status: finalStatus,
        totalRows: totalRows,
        successfulRows: successfulRows,
        badRows: badRows,
      });
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog(
          "sqlAndMongo",
          error.response?.data || { message: "An unknown error occurred." }
        );
      } else {
        updateTaskLog("sqlAndMongo", { message: "An unknown error occurred." });
      }
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog, clearTaskLog]);

  const handleUpdateFolioAndTransaction = useCallback(
    async (updateAll: boolean) => {
      setLoading(true);
      clearTaskLog("sqlAndMongo");
      updateTaskLog("sqlAndMongo", {
        message: "Updating folio and transaction",
      });
      try {
        const res = await updateFolioAndTransaction(updateAll);

        // LOGICAL BRIDGE: Handling potential nesting in the update response
        const updatedFolioRows = res.updatedFolioRows ?? 0;
        const updatedTransactionRows = res.updatedTransactionRows ?? 0;
        const badRows = res.badRows ?? res.summary?.errorRows ?? 0;

        let finalMessage =
          res.message || "Folio and Transaction update completed.";
        let finalStatus: "success" | "failed" = "success";

        if (badRows > 0) {
          finalMessage = `Folio and Transaction update completed: Folio Rows Updated: ${updatedFolioRows}, Transaction Rows Updated: ${updatedTransactionRows}, Bad Rows: ${badRows}.`;
          finalStatus = "failed";
        } else if (updatedFolioRows > 0 || updatedTransactionRows > 0) {
          finalMessage = `Folio and Transaction updated successfully. Folio Rows: ${updatedFolioRows}, Transaction Rows: ${updatedTransactionRows}.`;
          finalStatus = "success";
        } else {
          finalMessage = res.message || "No Folio or Transaction rows updated.";
          finalStatus = "success";
        }

        updateTaskLog("sqlAndMongo", {
          ...res,
          message: finalMessage,
          status: finalStatus,
          updatedFolioRows: updatedFolioRows,
          updatedTransactionRows: updatedTransactionRows,
          badRows: badRows,
        });
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          updateTaskLog(
            "sqlAndMongo",
            error.response?.data || { message: "An unknown error occurred." }
          );
        } else {
          updateTaskLog("sqlAndMongo", {
            message: "An unknown error occurred.",
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [updateTaskLog, clearTaskLog]
  );

  const handleReconnect = useCallback(async () => {
    setLoading(true);
    clearTaskLog("sqlAndMongo");
    updateTaskLog("sqlAndMongo", { message: "Reconnecting to the database" });
    try {
      const res = await reconnectDb();
      updateTaskLog("sqlAndMongo", res);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        updateTaskLog(
          "sqlAndMongo",
          error.response?.data || { message: "An unknown error occurred." }
        );
      } else {
        updateTaskLog("sqlAndMongo", { message: "An unknown error occurred." });
      }
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog, clearTaskLog]);

  return {
    loading,
    handleExecuteSql,
    handleUpdateFolioAndTransaction,
    handleReconnect,
    updateAll,
    setUpdateAll,
  };
};
