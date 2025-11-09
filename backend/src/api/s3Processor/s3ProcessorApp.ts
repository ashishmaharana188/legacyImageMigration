import express from "express";
import { listFiles, deleteFiles, searchFiles, searchFolders } from "./s3Manager";
import { uploadDirectoryRecursive, uploadSplitFilesToS3, uploadOriginalToS3 } from "./s3Uploader";
import { S3_BUCKET_NAME } from "../../utils/s3Config";

const s3ProcessorRouter = express.Router();

s3ProcessorRouter.post("/s3/list", async (req, res) => {
  const { prefix, continuationToken } = req.body;
  try {
    const result = await listFiles(prefix, continuationToken);
    res.json(result);
  } catch (error: unknown) {
    console.error("Error listing S3 files:", error);
    res.status(500).json({ message: "Failed to list S3 files", error: error instanceof Error ? error.message : String(error) });
  }
});

s3ProcessorRouter.post("/s3/delete", async (req, res) => {
  const { keys } = req.body;
  try {
    const deletedKeys = await deleteFiles(keys);
    res.json({ message: "Files deleted successfully", deletedKeys });
  } catch (error: unknown) {
    console.error("Error deleting S3 files:", error);
    res.status(500).json({ message: "Failed to delete S3 files", error: error instanceof Error ? error.message : String(error) });
  }
});

s3ProcessorRouter.post("/s3/search-files", async (req, res) => {
  const { prefix, pattern, continuationToken } = req.body;
  try {
    const result = await searchFiles(prefix, pattern, continuationToken);
    res.json(result);
  } catch (error: unknown) {
    console.error("Error searching S3 files:", error);
    res.status(500).json({ message: "Failed to search S3 files", error: error instanceof Error ? error.message : String(error) });
  }
});

s3ProcessorRouter.post("/s3/search-folders", async (req, res) => {
  const { prefix, pattern, continuationToken } = req.body;
  try {
    const result = await searchFolders(prefix, pattern, continuationToken);
    res.json(result);
  } catch (error: unknown) {
    console.error("Error searching S3 folders:", error);
    res.status(500).json({ message: "Failed to search S3 folders", error: error instanceof Error ? error.message : String(error) });
  }
});

s3ProcessorRouter.post("/s3/upload-directory", async (req, res) => {
  const { localDir, prefix } = req.body;
  try {
    const results = await uploadDirectoryRecursive(localDir, S3_BUCKET_NAME, prefix);
    res.json({ message: "Directory upload initiated", results });
  } catch (error: unknown) {
    console.error("Error uploading directory to S3:", error);
    res.status(500).json({ message: "Failed to upload directory to S3", error: error instanceof Error ? error.message : String(error) });
  }
});

s3ProcessorRouter.post("/s3/upload-original", async (req, res) => {
  const { localFilePath, s3Key } = req.body;
  try {
    const result = await uploadOriginalToS3(localFilePath, s3Key);
    res.json({ message: "Original file upload initiated", result });
  } catch (error: unknown) {
    console.error("Error uploading original file to S3:", error);
    res.status(500).json({ message: "Failed to upload original file to S3", error: error instanceof Error ? error.message : String(error) });
  }
});

s3ProcessorRouter.post("/s3/upload-split-files", async (req, res) => {
  const { localDir, prefix } = req.body;
  try {
    const results = await uploadSplitFilesToS3(localDir, prefix);
    res.json({ message: "Split files upload initiated", results });
  } catch (error: unknown) {
    console.error("Error uploading split files to S3:", error);
    res.status(500).json({ message: "Failed to upload split files to S3", error: error instanceof Error ? error.message : String(error) });
  }
});

export default s3ProcessorRouter;