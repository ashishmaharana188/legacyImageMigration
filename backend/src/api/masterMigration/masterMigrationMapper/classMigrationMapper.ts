// masterMigrationMapper.ts

interface Row {
  [key: string]: any;
}

const CLASS_FIELD_MAPPING: Record<string, string> = {
  client_code: "client_id",
  client_name: "client_id",
  fund_code: "fund_scheme_id",
  fund_name: "fund_scheme_id",
  plan_code: "plan_code",
  plan_name: "plan_name",
  class_code: "class_code",
  class_name: "class_name",
  class_category: "sip_category",
  min_amt: "min_amount",
  max_amt: "max_amount",
  management_fee: "management_fee",
  performance_fee: "performance_fee",
  hurdle_rate: "hurdle_rate",
  performance_fee_percentage: "performance_fee_percent",
  share_ratio: "share_ratio",
  additional_fee: "additional_fee",
  org_fee: "org_fee",
  gst_rate: "gst_rate",
  preferred_return: "preferred_return",
  max_return: "maximum_return",
  carry_percentage: "carry_percent",
  catchup_percentage: "catchup_percent",
  sponsor: "sub_class",
  currency: "currency",
  face_value: "face_value",
  frequency: "user_attr3",
  isin_code: "isin_code",
  high_water_mark: "high_water_mark",
  is_active: "is_active",
  setup_fee_percentage: "setup_fees_percent",
  class_contribution_percentage: "class_contribution_percentage",
  amc_plan: "amc_plan",
  fa_plan: "fa_plan",
  class_desc: "class_desc",
  sub_class: "sub_class",
  sponsor_class_percent: "sponsor_class_percent",
  repository_type: "repository_type",
  dp_client_id: "dp_client_id",
  dp_id: "dp_id",
  series_class: "user_attr3",
};

const SIP_PATTERN =
  /^\s*\{\{\s*"MLY"\s*,\s*\{\s*"((?:[1-9]|[12]\d|3[01]))"\s*\}\s*,\s*"(\d+)"\s*\}\}\s*$/;

function parseAllowedSipDetails(value: any) {
  if (value === null || value === undefined) {
    return {
      sip_frequency: null,
      sip_cycle_date: null,
      sip_installments: null,
    };
  }

  const match = String(value).trim().match(SIP_PATTERN);

  if (!match) {
    return {
      sip_frequency: null,
      sip_cycle_date: null,
      sip_installments: null,
    };
  }

  return {
    sip_frequency: "Monthly",
    sip_cycle_date: match[1],
    sip_installments: parseInt(match[2], 10),
  };
}

export function mapClassMaster(
  masterRows: Row[],
  clientRows: Row[],
  fundRows: Row[],
): Row[] {
  const clientLookup = new Map<string, Row>();

  for (const client of clientRows) {
    clientLookup.set(String(client.id), client);
  }

  const fundLookup = new Map<string, Row>();

  for (const fund of fundRows) {
    fundLookup.set(String(fund.id), fund);
  }

  const classLookup = new Map<string, string>();

  for (const row of masterRows) {
    if (row.id != null && row.class_code != null) {
      classLookup.set(String(row.id), String(row.class_code));
    }
  }

  const output: Row[] = [];

  for (const row of masterRows) {
    const mappedRow: Row = {};

    // Copy fields according to mapping
    for (const [outputField, inputField] of Object.entries(
      CLASS_FIELD_MAPPING,
    )) {
      mappedRow[outputField] =
        row[inputField] !== undefined ? row[inputField] : null;
    }

    // Fund lookup

    const fund = fundLookup.get(String(row.fund_scheme_id ?? ""));

    const client = clientLookup.get(String(row.client_id ?? ""));

    if (client) {
      mappedRow.client_code = client.client_code;
      mappedRow.client_name = client.client_name;
    }

    mappedRow.parent_class_code =
      classLookup.get(String(row.parent_class_id ?? "")) ?? null;

    mappedRow.is_series_class =
      mappedRow.parent_class_code &&
      String(mappedRow.parent_class_code).trim() !== ""
        ? "Y"
        : "N";

    if (fund) {
      mappedRow.fund_code = fund.fund_code;
      mappedRow.fund_name = fund.fund_name;
    } else {
      mappedRow.fund_code = null;
      mappedRow.fund_name = null;
    }

    // class category

    if (String(row.sip_category).toLowerCase() === "true") {
      mappedRow.class_category = "SIP";
    } else if (String(row.sip_category).toLowerCase() === "false") {
      mappedRow.class_category = "Non-SIP";
    } else {
      mappedRow.class_category = null;
    }

    //is active boolean

    if (String(row.is_active).toLowerCase() === "true") {
      mappedRow.is_active = "Y";
    } else if (String(row.is_active).toLowerCase() === "false") {
      mappedRow.is_active = "N";
    } else {
      mappedRow.is_active = null;
    }

    // Parse allowed_sip_details

    const sip = parseAllowedSipDetails(row.allowed_sip_details);

    mappedRow.sip_frequency = sip.sip_frequency;
    mappedRow.sip_cycle_date = sip.sip_cycle_date;
    mappedRow.sip_installments = sip.sip_installments;

    output.push(mappedRow);
  }

  return output;
}
