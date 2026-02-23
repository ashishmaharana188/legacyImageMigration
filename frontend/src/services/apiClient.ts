// frontend/src/api/apiClient.ts
import axios from "axios";

// 1. Create a shared Axios instance with a safe default
const apiClient = axios.create({
  baseURL: process.env.APP_BASE_URL || "http://localhost:3000",
});

// 2. Export a SINGLE promise that all services will wait for
export const configPromise = (async () => {
  try {
    // We use a hardcoded or env-based link for the INITIAL config fetch
    const response = await axios.get(`${apiClient.defaults.baseURL}/config`);

    if (response.data.apiBaseUrl) {
      // Update the instance baseURL globally
      apiClient.defaults.baseURL = response.data.apiBaseUrl;
      console.log(
        `[API Client] Base URL finalized: ${apiClient.defaults.baseURL}`
      );
    }
    return response.data;
  } catch (error) {
    console.error("[API Client] Configuration load failed:", error);
    return null;
  }
})();

export default apiClient;
