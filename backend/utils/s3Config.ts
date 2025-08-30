export const S3_BUCKET_NAME = "aif-in-a-box-assets-prod";

export function getS3Prefix(clientDirName: string): string {
  return `Data/APPLICATION_FORMS/${clientDirName}`;
}
