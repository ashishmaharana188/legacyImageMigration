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

export const fetchMasterHeaders = (tableName: string): Promise<string[]> => {
  return fetchHeaders("fund", tableName);
};

export const fetchMasterData = async (
  tableName: string,
): Promise<Record<string, any>[]> => {
  let client;

  try {
    const pool = await getPgPool();
    client = await pool.connect();

    const result = await client.query(`SELECT * FROM fund."${tableName}";`);

    return result.rows;
  } catch (error) {
    console.error(`Error fetching data from fund.${tableName}:`, error);

    throw new Error(`Failed to fetch data from '${tableName}'.`);
  } finally {
    client?.release();
  }
};
