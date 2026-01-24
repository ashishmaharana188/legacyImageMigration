export declare const S3_BUCKET_NAME: string;
export declare const AWS_ACCESS_KEY_ID: string | undefined;
export declare const AWS_SECRET_ACCESS_KEY: string | undefined;
export declare const AWS_SESSION_TOKEN: string | undefined;
export declare const AWS_DEFAULT_REGION: string;
export declare function getS3FilePrefix(clientDirName: string): string;
export declare function getS3SplitPrefix(clientDirName: string): string;
