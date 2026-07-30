interface Row {
  [key: string]: any;
}

export const BANK_FIELD_MAPPING: Record<string, string> = {
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

    if (String(row.is_active).toLowerCase() === "true") {
      mappedRow.is_active = "Y";
    } else if (String(row.is_active).toLowerCase() === "false") {
      mappedRow.is_active = "N";
    } else {
      mappedRow.is_active = "N";
    }

    output.push(mappedRow);
  }

  return output;
};

//mapping mongo

const date = new Date()
  .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
  .toUpperCase();

export const mapBankToMongo = (row: Row) => {
  return {
    currentStage: 4,
    entryDate: date,
    revisionNo: 2,
    recordStatus: 1,
    role: "C",
    status: "A",
    sourceUser: "system",
    checkerId: "system",
    updateFlag: "0",

    verificationMethod: "",
    verificationStatus: "",
    verifiedOn: "",

    clientCode: row.client_code,
    clientName: row.client_name,

    fundCode: row.fund_code,
    fundName: row.fund_name,

    bankAccountName: {
      updated: false,
      value: row.bank_account_name,
    },

    bankName: {
      updated: false,
      value: row.bank_name,
    },

    bankCode: {
      updated: false,
      value: row.bank_code,
    },

    ifscOrRtgsCode: {
      updated: false,
      value: row.ifsc_code,
    },

    currency: {
      updated: false,
      value: row.currency,
    },

    bicOrSwiftCode: {
      updated: false,
      value: row.swift_code,
    },

    corporateId: {
      updated: false,
      value: row.corporate_id,
    },

    branchName: {
      updated: false,
      value: row.branch_name,
    },

    city: {
      updated: false,
      value: row.city,
    },

    isActive: {
      updated: false,
      value: row.is_active,
    },

    bankAccountNumber: {
      updated: false,
      value: row.bank_account_number,
    },

    accountType: {
      updated: false,
      value: row.account_type,
    },

    ownershipType: {
      updated: false,
      value: row.ownership_type,
    },

    dormant: {
      updated: false,
      value: row.dormant_flag,
    },

    dormantDate: {
      updated: false,
      value: row.dormant_date,
    },

    remarks: {
      updated: false,
      value: row.remarks,
    },

    defaultAccount: {
      updated: false,
      value: "",
    },

    pennyDropStatus: {
      updated: false,
      value: false,
    },

    chequeUpload: {
      format: "",
      path: "",
      size: "",
    },
  };
};
