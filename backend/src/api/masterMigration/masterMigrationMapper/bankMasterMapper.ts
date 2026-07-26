interface Row {
  [key: string]: any;
}

const BANK_FIELD_MAPPING: Record<string, string> = {
  client_code: "client_id",
  client_name: "client_id",
  bank_name: "bank_name",
  bank_code: "bank_code",
  ifsc_code: "ifsc_code",
  currency: "currency",
  swift_code: "swift_code",
  corporate_id: "corporate_id",
  branch_name: "branch_name",
  city: "city",
  fund_code: "fund_scheme_id",
  fund_name: "fund_scheme_id",
  bank_account_name: "bank_account_name",
  bank_account_number: "bank_account_number",
  account_type: "account_type",
  ownership_type: "ownership_type",
  is_active: "is_active",
  dormant_flag: "is_dormant",
  dormant_date: "dormant_date",
  remarks: "remarks",
};

export const mapBankMaster = (
  masterRows: Row[],
  clientRows: Row[],
  fundRows: Row[],
): Row[] => {
  const clientLookup = new Map<string, Row>();
  const fundLookup = new Map<string, Row>();

  for (const client of clientRows) {
    clientLookup.set(String(client.id), client);
  }

  for (const fund of fundRows) {
    fundLookup.set(String(fund.id), fund);
  }

  const output: Row[] = [];

  for (const row of masterRows) {
    const mappedRow: Row = {};

    for (const [outputField, inputField] of Object.entries(
      BANK_FIELD_MAPPING,
    )) {
      mappedRow[outputField] =
        inputField === "default" ? null : (row[inputField] ?? null);
    }

    const client = clientLookup.get(String(row.client_id ?? ""));

    if (client) {
      mappedRow.client_code = client.client_code;
      mappedRow.client_name = client.client_name;
    } else {
      mappedRow.client_code = null;
      mappedRow.client_name = null;
    }

    const fund = fundLookup.get(String(row.fund_scheme_id ?? ""));

    if (fund) {
      mappedRow.fund_code = fund.fund_code;
      mappedRow.fund_name = fund.fund_name;
    } else {
      mappedRow.fund_code = null;
      mappedRow.fund_name = null;
    }

    output.push(mappedRow);
  }

  return output;
};
