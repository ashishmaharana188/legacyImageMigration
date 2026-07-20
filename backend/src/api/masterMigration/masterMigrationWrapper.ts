import { getPgPool } from "../../utils/dbConnect";

export const fetchClientMapHeaders = async (
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
      WHERE table_schema = 'stg'
        AND table_name = $1
      ORDER BY ordinal_position;
      `,
      [tableName],
    );

    return result.rows.map((row) => row.column_name);
  } catch (error) {
    console.error(`Error fetching headers for table ${tableName}:`, error);

    throw new Error(`Failed to fetch headers for table '${tableName}'.`);
  } finally {
    client?.release();
  }
};
