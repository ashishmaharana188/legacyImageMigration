import fs from "fs";
import path from "path";
import { stringify } from "csv-stringify/sync";
import { parse } from "csv-parse";
import {
  fetchStagingHeaders,
  fetchMasterHeaders,
  fetchMasterData,
  fetchClientData,
  fetchFundData,
  mapMasterToStaging,
  insertCSVToStaging,
  fetchStagingData,
  mapStagingToMongo,
} from "../masterMigration/masterMigrationWrapper";

import { validateStagingData } from "./masterMigrationMapper/stagingValidator";

interface Row {
  [key: string]: any;
}

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

        const headersForValidation =
          tableName === "class_map"
            ? uploadedHeaders.filter((header) => header !== "series_class")
            : uploadedHeaders;

        const missingHeaders = expectedHeaders.filter(
          (header) => !headersForValidation.includes(header),
        );

        if (missingHeaders.length > 0) {
          errors.push(`Missing expected headers: ${missingHeaders.join(", ")}`);
        }

        const unexpectedHeaders = headersForValidation.filter(
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
          return;
        }

        if (uploadedHeaders.length === 0) {
          resolve({
            status: "error",
            message:
              "Could not extract headers from the file. Is it a valid CSV?",
          });
          return;
        }
        const rows: Row[] = [];

        fs.createReadStream(filePath)
          .pipe(
            parse({
              columns: true,
              trim: true,
            }),
          )
          .on("data", (row: Row) => {
            rows.push(row);
          })
          .on("end", async () => {
            const validationResult = validateStagingData(tableName, rows);

            if (validationResult.status === "error") {
              resolve(validationResult);
              return;
            }

            const clientCode = rows[0]?.client_code;

            await insertCSVToStaging(filePath, tableName, clientCode);

            resolve({
              status: "success",
              message: "File validated and staging updated successfully.",
            });
          });
      })
      .on("error", (err) => {
        reject({
          status: "error",
          message: err.message,
        });
      });
  });
};

export const reorderToStagingHeaders = (
  mappedRows: Row[],
  stagingHeaders: string[],
): Row[] => {
  return mappedRows.map((row) => {
    const orderedRow: Row = {};

    for (const header of stagingHeaders) {
      orderedRow[header] = Object.prototype.hasOwnProperty.call(row, header)
        ? row[header]
        : null;
    }

    for (const [key, value] of Object.entries(row)) {
      if (!(key in orderedRow)) {
        orderedRow[key] = value;
      }
    }

    return orderedRow;
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

  const masterRows = await fetchMasterData(masterTable, clientCode);

  const clientRows = await fetchClientData(clientCode);

  const fundRows = await fetchFundData(clientCode);

  const stagingHeaders = await fetchStagingHeaders(stagingTable);

  const mappedRows = mapMasterToStaging(
    masterRows,
    clientRows,
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

  const outputFile = `${stagingTable}.csv`;
  const outputPath = path.join(outputDir, outputFile);

  console.log(`Saving mapped CSV to: ${outputPath}`);
  fs.writeFileSync(outputPath, csv);
  console.log("CSV generated successfully.");

  console.log("Start PG Staging Insert");

  const insertPgStaging = await insertCSVToStaging(
    outputPath,
    stagingTable,
    clientCode,
  );

  console.log("End PG Staging Insert");

  console.log(`Fetching data from stg.${stagingTable}...`);

  const stagingRows = await fetchStagingData(stagingTable, clientCode);

  console.log(`Fetched ${stagingRows.length} row(s).`);

  console.log("Mapping staging data to Mongo documents...");
  const mongoDocuments = mapStagingToMongo(stagingRows, masterType, clientCode);
  console.log("Mongo transfer completed.");

  return orderedRows;
};
