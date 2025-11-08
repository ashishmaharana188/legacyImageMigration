import axios from "axios";
import { FileResponse } from "./mongoTaskType";

const API_BASE_URL = "http://localhost:3000";

export const transferToMongo = async (updateAll: boolean, clientCode: string): Promise<FileResponse> => {
  const url = updateAll 
    ? `${API_BASE_URL}/update-mongo-transactions` 
    : `${API_BASE_URL}/transfer-to-mongo`;
  const res = await axios.post<FileResponse>(url, { clientCode });
  return res.data;
};
