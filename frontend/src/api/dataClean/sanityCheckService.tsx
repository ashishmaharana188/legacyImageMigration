import axios from "axios";
import { SanityCheckResponse } from "./sanityCheckType";

let API_BASE_URL: string = "http://localhost:3000"; // Default to backend port

const initConfiguration = async () => {
  try {
    const response = await axios.get<{ apiBaseUrl: string, frontendUrl: string }>(`http://localhost:3000/config`);
    if (response.data.apiBaseUrl) {
      API_BASE_URL = response.data.apiBaseUrl;
    }
    if (response.data.frontendUrl) {
      console.log(`Frontend URL from config: ${response.data.frontendUrl}`);
    }
    console.log(`Frontend using API_BASE_URL: ${API_BASE_URL}`);
  } catch (error) {
    console.error("Failed to fetch configuration, using default API_BASE_URL:", error);
  }
};

const configPromise = initConfiguration();

export const sanityCheckPgDuplicates = async (dryRun: boolean, normalize: boolean, cutoffTms: string, clientCode: string): Promise<SanityCheckResponse> => {
  await configPromise;
  const res = await axios.post<SanityCheckResponse>(
    `${API_BASE_URL}/sanity-check-duplicates`,
    {
      dryRun,
      normalize,
      cutoffTms,
      clientCode,
    }
  );
  return res.data;
};

export const sanityCheckMongoDuplicates = async (dryRun: boolean, cutoffTms: string, clientCode: string): Promise<SanityCheckResponse> => {
  await configPromise;
  const res = await axios.post<SanityCheckResponse>(
    `${API_BASE_URL}/sanity-check-duplicate-mongo`,
    {
      dryRun,
      cutoffTms,
      clientCode,
    }
  );
  return res.data;
};
