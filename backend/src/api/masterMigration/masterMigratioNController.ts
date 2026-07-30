import fs from "fs";
import { Request, Response } from "express";
import {
  stagingValidateUpsert,
  masterMigrateMongo,
} from "./masterMigrationCore";

export const stagingValidateUpsertController = async (
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

  const { masterType } = req.body;
  const { path, originalname } = req.file;
  const pushToMongo = req.body.pushToMongo === "true";

  try {
    const result = await stagingValidateUpsert(
      path,
      originalname,
      masterType,
      pushToMongo,
    );

    res.status(result.status === "success" ? 200 : 400).json(result);
  } catch (error) {
    console.error("Error during staging validation:", error);

    res.status(500).json({
      status: "error",
      message: "Error processing file.",
    });
  } finally {
    fs.unlink(path, (err) => {
      if (err) {
        console.error("Error deleting temporary file:", err);
      }
    });
  }
};

export const masterMigrateMongoController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { clientCode, fundCode, masterType, migrationType } = req.body;

  const pushToMongo = req.body.pushToMongo === "true";

  console.log(req.body);

  try {
    if (migrationType !== "Master-Staging-Mongo") {
      res.status(400).json({
        status: "error",
        message: `Unsupported migration type: ${migrationType}`,
      });
      return;
    }

    const result = await masterMigrateMongo(
      clientCode,
      fundCode,
      masterType,
      migrationType,
      pushToMongo,
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("Error during ETL process:", error);

    res.status(500).json({
      status: "error",
      message: "Error during ETL process.",
    });
  }
};
