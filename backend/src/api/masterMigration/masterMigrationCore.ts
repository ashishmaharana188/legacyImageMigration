import fs from "fs";
import path from "path";
import { stringify } from "csv-stringify/sync";
import { parse } from "csv-parse";
import {
  fetchStagingHeaders,
  fetchMasterHeaders,
  fetchMasterData,
} from "../masterMigration/masterMigrationWrapper";
import {
  mapMasterToStaging,
  fetchFundData,
  reorderToStagingHeaders,
} from "./masterMigrationMapper";

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
    expectedHeaders = await fetchStagingHeaders(tableName);
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

export const runETLProcess = async (
  clientCode: string,
  masterType: string,
  migrationType: string,
) => {
  const masterTable = masterType;

  const stagingTableMap: Record<string, string> = {
    client_master: "client_map",
    fund_scheme_master: "fund_scheme_map",
    class_plan_master: "class_map",
    plan_master: "plan_map",
    bank_master: "bank_map",
    contact_master: "contact_map",
  };

  const stagingTable = stagingTableMap[masterType];

  if (!stagingTable) {
    throw new Error(`Unsupported master type: ${masterType}`);
  }

  const masterRows = await fetchMasterData(masterTable);

  const fundRows = await fetchFundData(clientCode);

  const stagingHeaders = await fetchStagingHeaders(stagingTable);

  const mappedRows = mapMasterToStaging(
    masterRows,
    fundRows,
    migrationType,
    masterType,
  );

  const orderedRows = reorderToStagingHeaders(mappedRows, stagingHeaders);

  const outputDir = path.join(process.cwd(), "output");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const csv = stringify(orderedRows, {
    header: true,
  });

  fs.writeFileSync(path.join(outputDir, "class_map.csv"), csv);

  //await bulkInsertStaging(stagingTable, orderedRows);

  return orderedRows;
};
