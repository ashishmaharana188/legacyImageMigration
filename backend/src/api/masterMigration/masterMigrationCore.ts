import fs from "fs";
import { parse } from "csv-parse";
import { fetchClientMapHeaders } from "../masterMigration/masterMigrationWrapper";

export interface FileIntegrityCheckResult {
  status: "success" | "error";
  message: string;
}

export const checkFileHeaders = async (
  filePath: string,
  originalFileName: string,
): Promise<FileIntegrityCheckResult> => {
  const tableName = originalFileName.split(".").shift();

  if (!tableName) {
    return {
      status: "error",
      message: "Could not determine table name from original file name.",
    };
  }

  const allowedTableNames = [
    "client_map",
    "fund_scheme_map",
    "class_map",
    "plan_map",
    "bank_map",
    "contact_map",
  ];

  if (!allowedTableNames.includes(tableName)) {
    return {
      status: "error",
      message: `Invalid file name: ${originalFileName}. Allowed file names are: ${allowedTableNames.join(
        ", ",
      )}.`,
    };
  }

  let expectedHeaders: string[];

  try {
    expectedHeaders = await fetchClientMapHeaders(tableName);
  } catch (error) {
    return {
      status: "error",
      message: `Failed to retrieve expected headers for table ${tableName}: ${error}`,
    };
  }

  return new Promise<FileIntegrityCheckResult>((resolve, reject) => {
    const uploadedHeaders: string[] = [];
    const errors: string[] = [];

    fs.createReadStream(filePath)
      .pipe(
        parse({
          to_line: 1,
        }),
      )
      .on("data", (record: string[]) => {
        uploadedHeaders.push(...record);

        const missingHeaders = expectedHeaders.filter(
          (header) => !uploadedHeaders.includes(header),
        );

        if (missingHeaders.length > 0) {
          errors.push(`Missing expected headers: ${missingHeaders.join(", ")}`);
        }

        const unexpectedHeaders = uploadedHeaders.filter(
          (header) => !expectedHeaders.includes(header),
        );

        if (unexpectedHeaders.length > 0) {
          errors.push(
            `Unexpected headers found: ${unexpectedHeaders.join(", ")}`,
          );
        }
      })
      .on("data", () => {
        // Header validation only
      })
      .on("end", () => {
        if (errors.length > 0) {
          resolve({
            status: "error",
            message: errors.join("\n\n"),
          });
        } else if (uploadedHeaders.length === 0) {
          resolve({
            status: "error",
            message:
              "Could not extract headers from the file. Is it a valid CSV?",
          });
        } else {
          resolve({
            status: "success",
            message: "File integrity check passed.",
          });
        }
      })
      .on("error", (err) => {
        console.error("Error parsing CSV:", err);

        reject({
          status: "error",
          message: "Error processing file.",
        });
      });
  });
};
