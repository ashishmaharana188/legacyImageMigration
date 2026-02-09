import apiClient from "../../services/apiClient";
import { TransferResponse } from "./mongoTaskType";

// [CLEANUP] Removed updateMongoTransactionsService

export const transferDataFromPostgresService = async (
  clientCode?: string
): Promise<TransferResponse> => {
  const params = clientCode ? { clientCode } : {};
  const response = await apiClient.post<TransferResponse>(
    "/image-data/transfer-mongo",
    {},
    { params }
  );
  return response.data;
};
