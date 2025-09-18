import "dotenv/config";
export const S3_BUCKET_NAME =
  process.env.NODE_ENV === "development"
    ? "aif-in-a-box-assets-dev"
    : "aif-in-a-box-assets-prod";

export function getS3FilePrefix(clientDirName: string): string {
  return `Data/APPLICATION_FORMS/${clientDirName}`;
}
export function getS3SplitPrefix(clientDirName: string): string {
  return `Data/SPLIT_APPLICATION_FORMS/${clientDirName}`;
}
