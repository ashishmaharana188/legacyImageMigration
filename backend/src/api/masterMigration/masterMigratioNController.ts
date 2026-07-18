import fs from "fs";
import { Request, Response } from "express";
import { checkFileHeaders } from "../masterMigration/masterMigrationCore";

export const checkFileIntegrity = async (
  req: Request,
  res: Response,
): Promise<void> => {
  console.log("Received file:", req.file);

  if (!req.file) {
    res.status(400).json({
      status: "error",
      message: "No file uploaded.",
    });
    return;
  }

  const filePath = req.file.path;
  const originalFileName = req.file.originalname;

  try {
    const result = await checkFileHeaders(filePath, originalFileName);

    res.status(result.status === "success" ? 200 : 400).json(result);
  } catch (error) {
    console.error("Error during file integrity check:", error);

    res.status(500).json({
      status: "error",
      message: "Error processing file.",
    });
  } finally {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting temporary file:", err);
      }
    });
  }
};
