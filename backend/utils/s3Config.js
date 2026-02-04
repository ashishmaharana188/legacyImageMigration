"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AWS_DEFAULT_REGION = exports.AWS_SESSION_TOKEN = exports.AWS_SECRET_ACCESS_KEY = exports.AWS_ACCESS_KEY_ID = exports.S3_BUCKET_NAME = void 0;
exports.getS3FilePrefix = getS3FilePrefix;
exports.getS3SplitPrefix = getS3SplitPrefix;
exports.S3_BUCKET_NAME = process.env.NODE_ENV === "development"
    ? "aif-in-a-box-assets-dev"
    : "aif-in-a-box-assets-prod";
exports.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
exports.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
exports.AWS_SESSION_TOKEN = process.env.AWS_SESSION_TOKEN;
exports.AWS_DEFAULT_REGION = process.env.AWS_DEFAULT_REGION || "ap-south-1";
function getS3FilePrefix(clientDirName) {
    return `Data/APPLICATION_FORMS/${clientDirName}`;
}
function getS3SplitPrefix(clientDirName) {
    return `Data/SPLIT_APPLICATION_FORMS/${clientDirName}`;
}
