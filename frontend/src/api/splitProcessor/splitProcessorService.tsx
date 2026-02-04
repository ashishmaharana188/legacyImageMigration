import axios from "axios";
import { SplitFileResponse } from "./splitProcessorType";

let API_BASE_URL: string = "http://localhost:3000";

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
    console.log(`Frontend using API_BASE_URL: ${API_BASE_URL}`);
  } catch (error) {
    console.error("Failed to fetch configuration:", error);
    // Fallback or error handling if config cannot be loaded
  }
};

const configPromise = initConfiguration();

export const splitFile = async (
  endpoint: string
): Promise<SplitFileResponse> => {
  await configPromise; // Ensure configuration is loaded
  const res = await axios.post<SplitFileResponse>(
    `${API_BASE_URL}/${endpoint}`,
    {}
  );
  return res.data;
};

export const splitFileWithMuPDF = async (
  endpoint: string
): Promise<SplitFileResponse> => {
  await configPromise; // Ensure configuration is loaded
  const res = await axios.post<SplitFileResponse>(
    `${API_BASE_URL}/${endpoint}`,
    {}
  );
  return res.data;
};
