import axios from "axios";
import { FileResponse } from "./uploadProcessorType";
import dotenv from "dotenv";
import os from "os";
import path from "path";
import * as fs from "fs";

const userConfigDir = path.join(os.homedir(), ".appConfig");
const envPath = path.join(userConfigDir);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`Running UploadProcess on ${process.env.REACT_APP_API_BASE_UR}`);
}
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

export const uploadExcelFile = async (
  endpoint: string,
  selectedFile: File
): Promise<FileResponse> => {
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
