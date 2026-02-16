import apiClient from "../../services/apiClient";
import { TransferResponse } from "./mongoTaskType";

// [CLEANUP] Removed updateMongoTransactionsService

export const transferDataFromPostgresService = async (
  clientCode?: string,
  useCsv: boolean = true
): Promise<TransferResponse> => {
  // [CHANGE] We now send a JSON body instead of query params.
  // This matches the updated Backend Controller which checks req.body.
  const payload = {
    clientCode,
    useCsv
  };

  const response = await apiClient.post<TransferResponse>(
    "/image-data/transfer-mongo",
    payload
  );
  return response.data;
};
