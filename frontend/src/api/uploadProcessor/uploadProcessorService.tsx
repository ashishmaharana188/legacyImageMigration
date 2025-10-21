import axios from "axios";
import { FileResponse } from "./uploadProcessorType";

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
