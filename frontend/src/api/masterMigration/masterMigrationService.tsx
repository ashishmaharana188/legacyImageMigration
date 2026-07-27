import apiClient from "../../services/apiClient";

export interface FileIntegrityResponse {
  status: string;
  message?: string;
}
export interface ETLProcessResponse {
  status: string;
  message?: string;
}

interface ETLProcessPayload {
  clientCode: string;
  fundCode?: string;
  migrationType: string;
  masterType: string;
}
export const checkFileIntegrityService = async (
  file: File,
): Promise<FileIntegrityResponse> => {
  const formData = new FormData();
  formData.append("masterFile", file);

  const response = await apiClient.post<FileIntegrityResponse>(
    "/master-migrate/check-file-integrity",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return response.data;
};

export const runETLProcessService = async (
  clientCode: string,
  fundCode: string,
  migrationType: string,
  masterType: string,
  file?: File,
): Promise<ETLProcessResponse> => {
  const payload: ETLProcessPayload = {
    clientCode,
    fundCode,
    migrationType,
    masterType,
  };

  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    formData.append(key, value);
  });

  if (file) {
    formData.append("masterFile", file);
  }

  const response = await apiClient.post<ETLProcessResponse>(
    "/master-migrate/ETLProcess",
    formData,
  );

  return response.data;
};
