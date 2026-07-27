import fs from "fs";
import { Request, Response } from "express";
import { checkFileHeaders, runETLProcess } from "./masterMigrationCore";

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

export const runETLProcessController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { clientCode, fundCode, masterType, migrationType } = req.body;

  console.log(req.body);

  // File is only mandatory for upload migration
  if (migrationType === "Staging-Upsert-Mongo" && !req.file) {
    res.status(400).json({
      status: "error",
      message: "No file uploaded.",
    });
    return;
  }

  try {
    if (migrationType === "Master-Staging-Mongo") {
      const result = await runETLProcess(
        clientCode,
        fundCode,
        masterType,
        migrationType,
      );

      res.status(200).json(result);
      return;
    }

    res.status(400).json({
      status: "error",
      message: `Unsupported migration type: ${migrationType}`,
    });
  } catch (error) {
    console.error("Error during ETL process:", error);

    res.status(500).json({
      status: "error",
      message: "Error during ETL process.",
    });
  } finally {
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) {
          console.error("Error deleting temporary file:", err);
        }
      });
    }
  }
};
