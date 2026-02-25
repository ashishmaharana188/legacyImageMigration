import axios from "axios";
import { FileResponse } from "./uploadProcessorType";
import apiClient from "../../services/apiClient"
export let API_BASE_URL: string = "http://localhost:3000";
const initConfiguration = async () => {
  try {
    const response = await axios.get<{
      apiBaseUrl: string;
      frontendUrl: string;
    }>(`http://localhost:3000/config`);

    // 2. [FIX] Only overwrite if the backend actually sent a value
    if (response.data.apiBaseUrl) {
      API_BASE_URL = response.data.apiBaseUrl;
      console.log(`[Config] Frontend using API_BASE_URL: ${API_BASE_URL}`);
    } else {
      console.warn(
        "[Config] Backend returned empty URL. Keeping default: http://localhost:3000"
      );
    }

    if (response.data.frontendUrl) {
      console.log(
        `[Config] Frontend URL from config: ${response.data.frontendUrl}`
      );
    }
  } catch (error) {
    console.error(
      "Failed to fetch configuration. Using default localhost:3000.",
      error
    );
  }
};

export const configPromise = initConfiguration();

export const uploadExcelFile = async (
  endpoint: string,
  selectedFile: File
): Promise<FileResponse> => {
  await configPromise; // Ensure configuration is loaded
  const formData = new FormData();
  formData.append("excel", selectedFile);

  const res = await axios.post<FileResponse>(
    `${API_BASE_URL}/${endpoint}`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return res.data;
};

export const runFallbackCheck = async (
  endpoint: string,
  selectedFile: File
): Promise<FileResponse> => {
  await configPromise; // Ensure configuration is loaded
  const formData = new FormData();
  formData.append("excel", selectedFile);

  const res = await axios.post<FileResponse>(
    `${API_BASE_URL}/${endpoint}`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return res.data;
};

export const executeAthenaQuery = async (
  query: string,
  clientDirName: string = "default_client"
): Promise<{ statusCode: number; csvData: string }> => {
  await configPromise;
  // If you switched to using apiClient directly as discussed earlier:
  const res = await apiClient.post(`/run-athena`, { query, clientDirName });
  return res.data;
};
