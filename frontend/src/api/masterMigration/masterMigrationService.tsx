import apiClient from "../../services/apiClient";

export interface FileIntegrityResponse {
  status: string;
  message?: string;
}

export const checkFileIntegrity = async (
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
