import axios from "axios";
import { SplitFileResponse } from "./splitProcessorType";

let API_BASE_URL: string | undefined;

const initConfiguration = async () => {
  try {
    const response = await axios.get<{ apiBaseUrl: string, frontendUrl: string }>(`http://localhost:3000/config`);
    API_BASE_URL = response.data.apiBaseUrl;
    // If frontendUrl is needed elsewhere in the service, you can store it here as well.
    // For now, we'll just log it if it's present.
    if (response.data.frontendUrl) {
      console.log(`Frontend URL from config: ${response.data.frontendUrl}`);
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
