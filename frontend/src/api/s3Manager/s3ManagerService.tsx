import axios from "axios";
import { S3ApiResponse, SplitFileResponse, FileResponse } from "./s3ManagerType";

let API_BASE_URL: string | undefined;

const initConfiguration = async () => {
  try {
    const response = await axios.get<{ apiBaseUrl: string, frontendUrl: string }>(`http://localhost:3000/config`);
    API_BASE_URL = response.data.apiBaseUrl;
    if (response.data.frontendUrl) {
      console.log(`Frontend URL from config: ${response.data.frontendUrl}`);
    }
    console.log(`Frontend using API_BASE_URL: ${API_BASE_URL}`);
  } catch (error) {
    console.error("Failed to fetch configuration:", error);
  }
};

const configPromise = initConfiguration();

export const fetchS3Objects = async ({ pageParam, prefix = "Data/" }: { pageParam?: string; prefix?: string; }): Promise<S3ApiResponse> => {
  await configPromise;
  const { data } = await axios.get(`${API_BASE_URL}/s3-list-objects`, {
    params: { prefix, continuationToken: pageParam },
  });
  return data;
};

export const searchS3Folders = async ({ pageParam, prefix = "Data/", pattern = "" }: { pageParam?: string; prefix?: string; pattern?: string; }): Promise<S3ApiResponse> => {
  await configPromise;
  const { data } = await axios.get(`${API_BASE_URL}/s3-search-folders`, {
    params: { prefix, pattern, continuationToken: pageParam },
  });
  return data;
};

export const deleteS3Object = async (key: string) => {
  await configPromise;
  return axios.post(`${API_BASE_URL}/s3-delete-object`, { keys: [key] });
};

export const uploadOriginalToS3 = async (): Promise<FileResponse> => {
  await configPromise;
  const res = await axios.post<FileResponse>(
    `${API_BASE_URL}/upload-to-s3`
  );
  return res.data;
};

export const uploadSplitFilesToS3 = async (): Promise<FileResponse> => {
  await configPromise;
  const res = await axios.post<FileResponse>(
    `${API_BASE_URL}/upload-split-to-s3`,
    {}
  );
  return res.data;
};