import axios from "axios";
import { S3ApiResponse, S3UploadOptions, S3UploadResponse } from "./s3ManagerType";

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

export const fetchS3Objects = async ({ pageParam, prefix = "Data/" }: { pageParam?: string; prefix?: string; }): Promise<S3ApiResponse> => {
  await configPromise;
  const { data } = await axios.post(`${API_BASE_URL}/s3/list`, {
    prefix, continuationToken: pageParam,
  });
  return data;
};

export const searchS3Folders = async ({ pageParam, prefix = "Data/", pattern = "" }: { pageParam?: string; prefix?: string; pattern?: string; }): Promise<S3ApiResponse> => {
  await configPromise;
  const { data } = await axios.post(`${API_BASE_URL}/s3/search-folders`, {
    prefix, pattern, continuationToken: pageParam,
  });
  return data;
};

export const deleteS3Object = async (key: string) => {
  await configPromise;
  return axios.post(`${API_BASE_URL}/s3/delete`, { keys: [key] });
};

export const uploadOriginalToS3 = async (
  localDir: string,
  prefix: string,
  options: S3UploadOptions = {}
): Promise<S3UploadResponse> => {
  await configPromise;
  const res = await axios.post<S3UploadResponse>(
    `${API_BASE_URL}/s3/upload-directory`,
    { localDir, prefix, ...options }
  );
  return res.data;
};

export const uploadSplitFilesToS3 = async (
  localDir: string,
  prefix: string,
  options: S3UploadOptions = {}
): Promise<S3UploadResponse> => {
  await configPromise;
  const res = await axios.post<S3UploadResponse>(
    `${API_BASE_URL}/s3/upload-split-files`,
    { localDir, prefix, ...options }
  );
  return res.data;
};
