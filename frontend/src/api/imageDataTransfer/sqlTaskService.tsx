import apiClient from "../../services/apiClient";
import { FileResponse } from "./sqlTaskType";

export const executeSqlService = async (): Promise<FileResponse> => {
  const response = await apiClient.post<FileResponse>(
    "/image-data/execute-sql"
  );
  return response.data;
};

// [UPDATED] Accepts boolean to switch between CSV-based and Global update
export const updateFolioAndTransactionService = async (
  isUpdateAll: boolean
): Promise<FileResponse> => {
  const response = await apiClient.post<FileResponse>(
    "/image-data/update-folio",
    { updateAll: isUpdateAll } // Sends flag to backend
  );
  return response.data;
};

export const reconnectDbService = async (): Promise<FileResponse> => {
  const response = await apiClient.post<FileResponse>(
    "/image-data/reconnect-db"
  );
  return response.data;
};
