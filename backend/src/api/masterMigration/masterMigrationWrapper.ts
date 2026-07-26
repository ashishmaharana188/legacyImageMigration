import { getPgPool } from "../../utils/dbConnect";

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
  clientCode?: string,
): Promise<Record<string, any>[]> => {
  let client;

  try {
    const pool = await getPgPool();
    client = await pool.connect();

    let result;

    if (clientCode) {
      result = await client.query(
        `
        SELECT *
        FROM fund."${tableName}"
        WHERE client_id in (select id from fund.client_master where client_code = $1);
        `,
        [clientCode],
      );
    } else {
      result = await client.query(`SELECT * FROM fund."${tableName}";`);
    }
    return result.rows;
  } catch (error) {
    console.error(`Error fetching data from fund.${tableName}:`, error);

    throw new Error(`Failed to fetch data from '${tableName}'.`);
  } finally {
    client?.release();
  }
};
