@echo off
REM === AWS Credentials passed as arguments from Node ===
 
REM === Paths ===
set OUTPUT_DIR=%~dp0output
set S3_BUCKET=s3://aif-in-a-box-assets-prod/Data/APPLICATION_FORMS/
 
echo [INFO] Uploading from %OUTPUT_DIR% to %S3_BUCKET%
aws s3 cp "%OUTPUT_DIR%" %S3_BUCKET% --recursive
 
if %errorlevel% neq 0 (
    echo [ERROR] Upload failed!
    exit /b 1
) else (
    echo [INFO] Upload completed successfully.
)