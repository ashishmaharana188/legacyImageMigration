interface Row {
  [key: string]: any;
}

const CLIENT_FIELD_MAPPING: Record<string, string> = {
  client_code: "client_code",
  client_name: "client_name",
  domicile: "domicile",
  pan: "pan_or_tin",
  tin: "taxid_type",
  type: "client_type",
  address: "client_address",
  pin: "pin",
  city: "city",
  state: "state",
  country: "country",
  contact_number: "contact_number",
  company_logo: "client_logo_link",
  agreement_date: "agreement_date",
  lei_code: "lei_code",
  lei_code_validity: "lei_code_validity",
  kra_type: "kra_type",
  kra_login_id: "kra_login_id",
  kra_username: "kra_username",
  kra_password: "kra_password",
  kra_pos_code: "kra_pos_code",
  ckyc_userid: "ckyc_userid",
  ckyc_username: "ckyc_username",
  ckyc_password: "ckyc_password",
  ckyc_institution_code: "ckyc_institution_code",
  tenant_id: "tenant_id",
};

export const mapClientMaster = (masterRows: Row[]): Row[] => {
  const output: Row[] = [];

  for (const row of masterRows) {
    const mappedRow: Row = {};

    for (const [outputField, inputField] of Object.entries(
      CLIENT_FIELD_MAPPING,
    )) {
      mappedRow[outputField] =
        inputField === "default" ? null : (row[inputField] ?? null);
    }

    output.push(mappedRow);
  }

  return output;
};
