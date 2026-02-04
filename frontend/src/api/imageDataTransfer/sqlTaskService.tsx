import axios from "axios";

const API_BASE_URL = "http://localhost:3000/api/imageDataTransfer";

export const executeSqlService = async () => {
  const response = await axios.post(`${API_BASE_URL}/execute-sql`);
  return response.data;
};

export const updateFolioAndTransactionService = async (
  updateAll: boolean,
  transactions: any[],
  initialLogs: any[]
) => {
  const response = await axios.post(`${API_BASE_URL}/update-folio`, {
    updateAll,
    transactions,
    initialLogs,
  });
  return response.data;
};

// [ADDED]
export const reconnectDbService = async () => {
  const response = await axios.post(`${API_BASE_URL}/reconnect-db`);
  return response.data;
};
