import apiClient from "../../services/apiClient";

export interface stagingUpsertValidate {
  status: string;
  message?: string;
}
export interface masterMigrateMongo {
  status: string;
  message?: string;
}

interface masterMigrateMongoPayload {
  clientCode: string;
  fundCode?: string;
  migrationType: string;
  masterType: string;
  pushToMongo: boolean;
}

//staging upsert request
export const stagingValidationUpsert = async (
  file: File,
  masterType: string,
  migrationType: string,
  pushToMongo: boolean,
): Promise<stagingUpsertValidate> => {
  const formData = new FormData();

  formData.append("masterFile", file);

  formData.append("masterType", masterType);
  formData.append("migrationType", migrationType);
  formData.append("pushToMongo", pushToMongo.toString());

  const response = await apiClient.post<stagingUpsertValidate>(
    "/master-migrate/stagingUpsertMongo",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return response.data;
};

//masterMigration request
export const masterStagingMongo = async (
  clientCode: string,
  fundCode: string,
  migrationType: string,
  masterType: string,
  pushToMongo: boolean,
  file?: File,
): Promise<masterMigrateMongo> => {
  const payload: masterMigrateMongoPayload = {
    clientCode,
    fundCode: fundCode.trim() === "" ? undefined : fundCode,
    migrationType,
    masterType,
    pushToMongo,
  };

  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined) {
      formData.append(key, value);
    }
  });

  if (file) {
    formData.append("masterFile", file);
  }

  const response = await apiClient.post<masterMigrateMongo>(
    "/master-migrate/masterStagingMongo",
    formData,
  );

  return response.data;
};
