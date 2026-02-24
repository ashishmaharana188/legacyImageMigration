export const S3_BUCKET_NAME =
  process.env.NODE_ENV === "development"
    ? "aif-in-a-box-assets-dev"
    : "aif-in-a-box-assets-prod";

export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
export const AWS_SESSION_TOKEN = process.env.AWS_SESSION_TOKEN;
export const AWS_DEFAULT_REGION =
  process.env.AWS_DEFAULT_REGION || "ap-south-1";

export function getS3FilePrefix(clientDirName: string): string {
  return `Data/APPLICATION_FORMS/${clientDirName}`;
}
export function getS3SplitPrefix(clientDirName: string): string {
  return `Data/SPLIT_APPLICATION_FORMS/${clientDirName}`;
}
