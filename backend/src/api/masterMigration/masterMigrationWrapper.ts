import { getPgPool } from "../../utils/dbConnect";
import fs from "fs";
import { parse } from "csv-parse";
import { mapClientMaster } from "../masterMigration/masterMigrationMapper/clientMasterMapper";
import { mapFundMaster } from "../masterMigration/masterMigrationMapper/fundMasterMapper";
import { mapClassMaster } from "../masterMigration/masterMigrationMapper/classMigrationMapper";
import { mapBankMaster } from "../masterMigration/masterMigrationMapper/bankMasterMapper";

import { mapClientToMongo } from "./masterMigrationMapper/clientMasterMapper";
import { mapFundToMongo } from "./masterMigrationMapper/fundMasterMapper";
import { mapClassToMongo } from "./masterMigrationMapper/classMigrationMapper";
import { mapBankToMongo } from "./masterMigrationMapper/bankMasterMapper";

import { CLIENT_FIELD_MAPPING } from "../masterMigration/masterMigrationMapper/clientMasterMapper";

import { FUND_FIELD_MAPPING } from "../masterMigration/masterMigrationMapper/fundMasterMapper";

import { CLASS_FIELD_MAPPING } from "../masterMigration/masterMigrationMapper/classMigrationMapper";

import { BANK_FIELD_MAPPING } from "../masterMigration/masterMigrationMapper/bankMasterMapper";

import { upsertQueryMap } from "../masterMigration/masterMigrationMapper/upsertQueryMap";

import {
  connectMongo,
  disconnectMongo,
  getMongoDb,
} from "../../utils/dbConnect";

interface Row {
  [key: string]: any;
}

export const stagingTableMap: Record<string, string> = {
  client_master: "client_map",
  fund_scheme_master: "fund_scheme_map",
  class_plan_master: "class_map",
  plan_master: "plan_map",
  bank_master: "bank_map",
  contact_master: "contact_map",
};

const fetchHeaders = async (
  schema: "stg" | "fund",
  tableName: string,
): Promise<string[]> => {
  let client;

  try {
    const pool = await getPgPool();
    client = await pool.connect();

    const result = await client.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
      ORDER BY ordinal_position;
      `,
      [schema, tableName],
    );

    return result.rows.map((row) => row.column_name);
  } catch (error) {
    console.error(`Error fetching headers for ${schema}.${tableName}:`, error);

    throw new Error(`Failed to fetch headers for '${schema}.${tableName}'.`);
  } finally {
    client?.release();
  }
};

export const fetchStagingHeaders = (tableName: string): Promise<string[]> => {
  return fetchHeaders("stg", tableName);
};

export const fetchClientData = async (
  clientCode: string,
): Promise<Record<string, any>[]> => {
  let client;

  try {
    const pool = await getPgPool();
    client = await pool.connect();

    const result = await client.query(
      `
      SELECT id,
             client_code,
             client_name
      FROM fund.client_master
      WHERE client_code = $1;
      `,
      [clientCode],
    );

    return result.rows;
  } finally {
    client?.release();
  }
};

export const fetchFundData = async (
  clientCode: string,
): Promise<Record<string, any>[]> => {
  let client;

  try {
    const pool = await getPgPool();
    client = await pool.connect();

    const result = await client.query(
      `
      SELECT id,
             fund_code,
             fund_name
      FROM fund.fund_scheme_master
      WHERE client_id in (select id from fund.client_master where client_code = $1);
      `,
      [clientCode],
    );

    return result.rows;
  } finally {
    client?.release();
  }
};

export const fetchMasterHeaders = (tableName: string): Promise<string[]> => {
  return fetchHeaders("fund", tableName);
};

export const fetchMasterData = async (
  tableName: string,
  clientCode: string,
  fundCode?: string,
): Promise<Record<string, any>[]> => {
  let client;
  console.log({
    clientCode,
    fundCode,
    type: typeof fundCode,
  });
  try {
    const pool = await getPgPool();
    client = await pool.connect();

    let result;

    // Client Master
    if (tableName === "client_master") {
      result = await client.query(
        `
        SELECT *
        FROM fund.client_master
        WHERE client_code = $1;
        `,
        [clientCode],
      );
    }

    // Fund Master
    else if (tableName === "fund_scheme_master") {
      result = await client.query(
        `
        SELECT *
        FROM fund.fund_scheme_master
        WHERE client_id IN (
          SELECT id
          FROM fund.client_master
          WHERE client_code = $1
        )
        AND ($2::text IS NULL OR fund_code = $2);
        `,
        [clientCode, fundCode ?? null],
      );
    } else {
      result = await client.query(
        `
        SELECT *
        FROM fund."${tableName}"
        WHERE client_id IN (
          SELECT id
          FROM fund.client_master
          WHERE client_code = $1
        )
        AND (
          $2::text IS NULL
          OR fund_scheme_id IN (
            SELECT id
            FROM fund.fund_scheme_master
            WHERE client_id IN (
              SELECT id
              FROM fund.client_master
              WHERE client_code = $1
            )
            AND fund_code = $2
          )
        );
        `,
        [clientCode, fundCode ?? null],
      );
    }

    return result.rows;
  } catch (error) {
    console.error(`Error fetching data from fund.${tableName}:`, error);
    throw new Error(`Failed to fetch data from '${tableName}'.`);
  } finally {
    client?.release();
  }
};

export const FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  client_master: CLIENT_FIELD_MAPPING,
  fund_scheme_master: FUND_FIELD_MAPPING,
  class_plan_master: CLASS_FIELD_MAPPING,
  bank_master: BANK_FIELD_MAPPING,
};

export const fetchMasterDateColumns = async (
  tableName: string,
): Promise<Set<string>> => {
  let client;

  try {
    const pool = await getPgPool();
    client = await pool.connect();

    const result = await client.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'fund'
        AND table_name = $1
        AND data_type = 'date';
      `,
      [tableName],
    );

    return new Set(result.rows.map((r) => r.column_name));
  } finally {
    client?.release();
  }
};

const formatDate = (value: any): string | null => {
  if (value == null || value === "") {
    return null;
  }

  if (value instanceof Date) {
    const dd = String(value.getDate()).padStart(2, "0");
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const yyyy = value.getFullYear();

    return `${yyyy}-${mm}-${dd}`;
  }

  const d = new Date(value);

  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();

  return `${yyyy}-${mm}-${dd}`;
};

export const normalizeDates = async (
  rows: Row[],
  masterType: string,
): Promise<Row[]> => {
  const mapper = FIELD_MAPPINGS[masterType];

  if (!mapper) {
    throw new Error(`Unsupported master type: ${masterType}`);
  }

  const masterDateColumns = await fetchMasterDateColumns(masterType);

  return rows.map((row) => {
    const normalized = { ...row };

    for (const [mappedColumn, masterColumn] of Object.entries(mapper)) {
      if (!masterDateColumns.has(masterColumn)) {
        continue;
      }

      normalized[mappedColumn] = formatDate(normalized[mappedColumn]);
    }

    return normalized;
  });
};

export const mapMasterToStaging = (
  masterRows: Row[],
  clientRows: Row[],
  fundRows: Row[],
  migrationType: string,
  masterType: string,
): Row[] => {
  switch (migrationType) {
    case "Master-Staging-Mongo":
      switch (masterType) {
        case "client_master":
          return mapClientMaster(masterRows);

        case "fund_scheme_master":
          return mapFundMaster(masterRows, clientRows);

        case "class_plan_master":
          return mapClassMaster(masterRows, clientRows, fundRows);

        case "bank_master":
          return mapBankMaster(masterRows, clientRows, fundRows);

        default:
          throw new Error(`Unsupported master type ${masterType}`);
      }

    default:
      throw new Error(`Unsupported migration type ${migrationType}`);
  }
};

export const insertCSVToStaging = async (
  csvPath: string,
  stagingTable: string,
  clientCode: string,
  fundCode?: string,
): Promise<void> => {
  const rows: Record<string, any>[] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(
        parse({
          columns: true,
          trim: true,
          skip_empty_lines: true,
        }),
      )
      .on("data", (row) => rows.push(row))
      .on("end", resolve)
      .on("error", reject);
  });

  if (rows.length === 0) {
    console.log("CSV contains no rows.");
    return;
  }

  const client = await (await getPgPool()).connect();

  try {
    console.log(`Starting PG staging insert into stg.${stagingTable}...`);

    await client.query("BEGIN");

    const result = await client.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'stg'
        AND table_name = $1
      ORDER BY ordinal_position;
      `,
      [stagingTable],
    );

    const columns = result.rows.map((r) => r.column_name);

    if (!columns.length) {
      throw new Error(`No columns found for stg.${stagingTable}`);
    }

    const filteredRows = rows.map((row) => {
      const filtered: Record<string, any> = {};

      for (const column of columns) {
        const value = row[column];

        if (value === undefined || value === null) {
          filtered[column] = null;
        } else if (typeof value === "string") {
          const trimmed = value.trim();
          filtered[column] = trimmed === "" ? null : trimmed;
        } else {
          filtered[column] = value;
        }
      }

      return filtered;
    });

    let uniqueRows = filteredRows;

    if (stagingTable === "class_map") {
      const seen = new Set<string>();

      uniqueRows = [];

      for (const row of filteredRows) {
        const key = [
          row.client_code?.toString().trim() ?? "",
          row.fund_code?.toString().trim() ?? "",
          row.class_code?.toString().trim() ?? "",
        ].join("|");

        if (seen.has(key)) {
          console.warn(`Duplicate class skipped: ${key}`);
          continue;
        }

        seen.add(key);
        uniqueRows.push(row);
      }

      console.log(
        `Removed ${filteredRows.length - uniqueRows.length} duplicate class record(s).`,
      );
    }

    console.log(`Deleting existing staging data for client ${clientCode}...`);

    let deleteResult;

    if (stagingTable === "client_map") {
      deleteResult = await client.query(
        `
    DELETE FROM stg.client_map
    WHERE client_code = $1;
    `,
        [clientCode],
      );
    } else {
      deleteResult = await client.query(
        `
    DELETE FROM stg."${stagingTable}"
    WHERE client_code = $1
      AND ($2::text IS NULL OR fund_code = $2::text);
    `,
        [clientCode, fundCode ?? null],
      );
    }

    console.log(
      `Deleted ${deleteResult.rowCount} row(s) from stg.${stagingTable}.`,
    );

    console.log("Existing staging data removed.");

    const BATCH_SIZE = 250;

    for (let start = 0; start < uniqueRows.length; start += BATCH_SIZE) {
      const batch = uniqueRows.slice(start, start + BATCH_SIZE);

      const values: any[] = [];
      const placeholders: string[] = [];

      batch.forEach((row, rowIndex) => {
        const rowPlaceholders: string[] = [];

        columns.forEach((column, columnIndex) => {
          values.push(row[column]);

          rowPlaceholders.push(
            `$${rowIndex * columns.length + columnIndex + 1}`,
          );
        });

        placeholders.push(`(${rowPlaceholders.join(",")})`);
      });

      const sql = `
        INSERT INTO stg."${stagingTable}"
        (${columns.map((c) => `"${c}"`).join(",")})
        VALUES
        ${placeholders.join(",")}
      `;

      await client.query(sql, values);

      console.log(
        `Inserted ${Math.min(start + BATCH_SIZE, uniqueRows.length)} / ${uniqueRows.length} rows.`,
      );
    }

    await client.query("COMMIT");

    console.log(
      `Successfully inserted ${uniqueRows.length} rows into stg.${stagingTable}.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("PG staging insert failed:", error);
    throw error;
  } finally {
    client.release();
  }
};

const mongoCollectionMap: Record<string, string> = {
  client_master: "client_master",
  fund_scheme_master: "fund_master",
  class_plan_master: "class_master",
  bank_master: "bank_master",
};

export const fetchStagingData = async (
  tableName: string,
  clientCode: string,
  fundCode?: string,
): Promise<Record<string, any>[]> => {
  let client;

  try {
    const pool = await getPgPool();
    client = await pool.connect();

    let result;

    // Client map
    if (tableName === "client_map") {
      result = await client.query(
        `
        SELECT *
        FROM stg.client_map
        WHERE client_code = $1;
        `,
        [clientCode],
      );
    }

    // Fund / Class / Plan / Bank / Contact / etc.
    else {
      result = await client.query(
        `
        SELECT *
        FROM stg."${tableName}"
        WHERE client_code = $1
        AND ($2::text IS NULL OR fund_code = $2);
        `,
        [clientCode, fundCode ?? null],
      );
    }

    return result.rows;
  } catch (error) {
    console.error(`Error fetching data from stg.${tableName}:`, error);

    throw new Error(`Failed to fetch data from staging table '${tableName}'.`);
  } finally {
    client?.release();
  }
};

//mongo deletion
const deleteMongoRecords = async (
  collectionName: string,
  clientCode: string,
  fundCode?: string,
): Promise<void> => {
  if (!clientCode) {
    throw new Error("Client code is required to delete Mongo records.");
  }

  try {
    await connectMongo();
    const db = getMongoDb();

    const collection = db.collection(collectionName);

    const filter: Record<string, any> = {
      clientCode,
    };

    if (fundCode) {
      filter.fundCode = fundCode;
    }

    const result = await collection.deleteMany(filter);

    console.log(
      `Deleted ${result.deletedCount} document(s) from ${collectionName} for client ${clientCode}.`,
    );
  } catch (error) {
    console.error(
      `Failed deleting Mongo records from ${collectionName}:`,
      error,
    );
    throw error;
  } finally {
    await disconnectMongo();
  }
};

//mongo insert
const insertMongoRecords = async (
  collectionName: string,
  documents: any[],
): Promise<void> => {
  if (!documents.length) {
    console.log("No Mongo documents to insert.");
    return;
  }

  try {
    await connectMongo();

    const db = getMongoDb();

    const collection = db.collection(collectionName);

    const result = await collection.insertMany(documents);

    console.log(
      `Inserted ${result.insertedCount} document(s) into ${collectionName}.`,
    );
  } catch (error) {
    console.error(
      `Failed inserting Mongo records into ${collectionName}:`,
      error,
    );
    throw error;
  } finally {
    await disconnectMongo();
  }
};

//mongo mapping and insert/delete
export const mapStagingToMongo = async (
  stagingRows: Row[],
  masterType: string,
  clientCode: string,
  fundCode?: string,
): Promise<void> => {
  let mongoDocuments: any[];

  switch (masterType) {
    case "class_plan_master":
      mongoDocuments = stagingRows.map(mapClassToMongo);
      break;

    case "client_master":
      mongoDocuments = stagingRows.map(mapClientToMongo);
      break;

    case "fund_scheme_master":
      mongoDocuments = stagingRows.map(mapFundToMongo);
      break;

    case "bank_master":
      mongoDocuments = stagingRows.map(mapBankToMongo);
      break;

    default:
      throw new Error(`Unsupported master type: ${masterType}`);
  }

  if (!mongoDocuments.length) {
    throw new Error("No Mongo documents generated.");
  }

  const collectionName = mongoCollectionMap[masterType];
  console.log(`Deleting Mongo documents for client ${clientCode}...`);
  await deleteMongoRecords(collectionName, clientCode, fundCode);
  console.log("Mongo cleanup completed.");

  console.log(`Inserting ${mongoDocuments.length} Mongo documents...`);
  await insertMongoRecords(collectionName, mongoDocuments);
  console.log("Mongo insert completed.");
};

export const transferToMongo = async (
  clientCode: string,
  fundCode: string | undefined,
  masterType: string,
) => {
  const stagingTable = stagingTableMap[masterType];

  console.log(`Fetching data from stg.${stagingTable}...`);

  const stagingRows = await fetchStagingData(
    stagingTable,
    clientCode,
    fundCode,
  );

  console.log(`Fetched ${stagingRows.length} row(s).`);

  console.log("Mapping staging data to Mongo documents...");
  await mapStagingToMongo(stagingRows, masterType, clientCode, fundCode);

  console.log("Mongo transfer completed.");
};

export const runStagingUpsert = async (
  stagingTable: keyof typeof upsertQueryMap,
  clientCode: string,
  fundCode?: string,
): Promise<void> => {
  let client;

  try {
    const pool = await getPgPool();
    client = await pool.connect();

    const query = upsertQueryMap[stagingTable];

    if (!query) {
      throw new Error(`No upsert query found for ${stagingTable}`);
    }

    const params =
      stagingTable === "client_map"
        ? [clientCode]
        : [clientCode, fundCode ?? null];

    await client.query("BEGIN");

    const result = await client.query(query, params);
    console.log({
      command: result.command,
      rowCount: result.rowCount,
    });

    await client.query("COMMIT");

    console.log(`${stagingTable} upsert completed successfully.`);
  } catch (error) {
    await client?.query("ROLLBACK");
    throw error;
  } finally {
    client?.release();
  }
};
