import axios from "axios";
import { FileResponse } from "./sqlTaskType";

const API_BASE_URL = "http://localhost:3000";

export const generateSql = async (): Promise<FileResponse> => {
  const res = await axios.post<FileResponse>(`${API_BASE_URL}/generate-sql`);
  return res.data;
};

export const executeSql = async (): Promise<FileResponse> => {
  const res = await axios.post<FileResponse>(`${API_BASE_URL}/process-sql-mongo`, { action: "executeSql" });
  return res.data;
};

export const updateFolioAndTransaction = async (updateAll: boolean): Promise<FileResponse> => {
  const res = await axios.post<FileResponse>(`${API_BASE_URL}/process-sql-mongo`, { action: "updateFolioAndTransaction", updateAll });
  return res.data;
};

export const reconnectDb = async (): Promise<FileResponse> => {
  const res = await axios.post<FileResponse>(`${API_BASE_URL}/reconnect`);
  return res.data;
};
