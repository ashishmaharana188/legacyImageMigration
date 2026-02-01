import axios from "axios";

const API_BASE_URL = "http://localhost:3000/api/imageDataTransfer";

export const transferDataFromPostgresService = async (clientCode?: string) => {
  const params = clientCode ? { clientCode } : {};
  const response = await axios.get(`${API_BASE_URL}/transfer-postgres`, {
    params,
  });
  return response.data;
};

export const updateMongoTransactionsService = async (clientId?: number) => {
  const params = clientId ? { clientId } : {};
  const response = await axios.get(`${API_BASE_URL}/update-mongo`, { params });
  return response.data;
};
