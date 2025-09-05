export const S3_BUCKET_NAME = "aif-in-a-box-assets-prod";

export function getS3FilePrefix(clientDirName: string): string {
  return `Data/APPLICATION_FORMS/${clientDirName}`;
}
export function getS3SplitPrefix(clientDirName: string): string {
  return `Data/SPLIT_APPLICATION_FORMS/${clientDirName}`;
}
