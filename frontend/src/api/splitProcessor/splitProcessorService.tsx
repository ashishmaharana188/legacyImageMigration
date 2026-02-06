import axios from "axios";
import { SplitFileResponse } from "./splitProcessorType";
import apiClient, { configPromise } from "../../services/apiClient";

export const splitFile = async (
  endpoint: string
): Promise<SplitFileResponse> => {
  await configPromise; // Ensure configuration is loaded
  const res = await apiClient.post<SplitFileResponse>(`/${endpoint}`, {});
  return res.data;
};

export const splitFileWithMuPDF = async (
  endpoint: string
): Promise<SplitFileResponse> => {
  await configPromise;
  const res = await apiClient.post<SplitFileResponse>(`/${endpoint}`, {});
  return res.data;
};
