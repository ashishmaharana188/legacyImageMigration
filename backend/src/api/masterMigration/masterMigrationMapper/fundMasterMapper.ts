interface Row {
  [key: string]: any;
}

const FUND_FIELD_MAPPING: Record<string, string> = {
  client_code: "client_id",
  client_name: "client_id",
  fund_code: "fund_code",
  fund_name: "fund_name",
  fund_short_name: "fund_short_name",
  fund_domicile: "domicile",
  fund_business_type: "business_type",
  service_model: "service_model",
  fund_category: "fund_category",
  fund_sub_category: "fund_subcategory",
  fund_nature: "fund_nature",
  fund_face_value: "fund_facevalue",
  fund_currency: "currency",
  fund_period: "fund_period",
  fund_registration_number: "fund_registration_number",
  pan_or_tin: "pan_or_tin",
  gstin: "goods_service_tax_percent",
  fund_isin_number: "fund_isin_number",
  fund_depository_type: "fund_depository_type",
  fund_dp_id: "fund_dpclid",
  fund_client_id: "default",
  fund_start_date1: "fund_start_date",
  fund_initial_contribution_start_date: "fund_initial_contribution_start_date",
  fund_initial_contribution_close_date: "fund_initial_contribution_close_date",
  fund_end_date: "fund_end_date",
  fund_maturity_date: "fund_maturity_date",
  fund_max_investors: "fund_max_investors",
  fund_initial_contribution_amount: "fund_initial_contribution_amount",
  fund_initial_contribution_percentage: "fund_initial_contribution_percentage",
  fund_size: "fund_size_corpus",
  fund_sponsor_name: "fund_sponsor_name",
  fund_investment_manager: "fund_investment_manager",
  fund_trustee_name: "fund_trustee_name",
  tax_advisor_name: "tax_advisor_name",
  legal_advisor_name: "legal_advisor_name",
  fund_custodian_code: "fund_custodian_code",
  fund_accountant_name: "fund_accountant_name",
  fund_accountant_email: "fund_accountant_email",
  fund_accountant_contact_number: "fund_accountant_contact_number",
  transfer_agent_name: "transfer_agent_name",
  transfer_agent_accountant_email: "transfer_agent_accountant_email",
  transfer_agent_contact_number: "transfer_agent_contact_number",
  fund_rta_code: "fund_rta_code",
  fund_start_date2: "default",
  fund_previous_date: "fund_previous_date",
  fund_current_date: "fund_current_date",
  fund_next_date: "fund_next_date",
  fund_previous_year_end: "fund_previous_year_end",
  fund_current_year_end: "fund_current_year_end",
  prev_nav_date_: "prev_nav_date",
  nav_frequency: "nav_frequency",
  next_nav_date: "next_nav_date",
  nav_publish_type: "nav_publish_type",
  prev_nav_pub_date: "prev_nav_pub_date",
  nav_pub_frequency: "nav_pub_frequency",
  next_nav_pub_date: "next_nav_pub_date",
  fund_pl_comp_method: "fund_pl_comp_method",
  valuation_sequence: "valuation_sequence",
  unit_decimals: "unit_decimals",
  round_method_: "round_method",
  round_decimals: "round_decimals",
  fund_dd_notice_period: "fund_dd_notice_period",
  fund_dd_penalty_charges: "fund_dd_penalty_charges",
  fund_topup_treatment: "fund_topup_treatment",
  fund_dd_treatment: "fund_dd_treatment",
  fund_management_fee: "fund_management_fee",
  fund_additional_fee: "fund_additional_fee",
  setup_fee_percentage: "setup_fee_percent",
  fund_trustee_fee: "fund_trustee_fee",
  operating_expenses: "operating_expenses",
  gst_percentage: "goods_service_tax_percent",
  defaulter_penalty: "defaulter_penalty",
  fund_commitment_applicability_: "fund_commitment_applicability",
  preferred_rate_of_return: "preferred_rate_of_return",
  hurdle_rate_: "hurdle_rate",
  high_water_mark: "high_water_mark",
  hurdle_start_date_: "hurdle_start_date",
  gp_sharing_ration: "gp_sharing_ration",
  distribution_frequency: "distribution_frequency",
  forex_source: "forex_source",
  nav_ratio_method: "nav_ratio_method",
  is_active: "is_active",
  dormant_flag: "is_dormant",
  dormant_date: "dormant_date",
  fund_stamp_duty_bourne: "fund_stamp_duty_bourne",
  nav_decimals: "nav_decimals",
  amount_decimals: "amount_decimals",
  fund_from: "default",
};

export function mapFundMaster(masterRows: Row[], clientRows: Row[]): Row[] {
  const clientLookup = new Map<string, Row>();

  for (const client of clientRows) {
    clientLookup.set(String(client.id), client);
  }

  const output: Row[] = [];

  for (const row of masterRows) {
    const mappedRow: Row = {};

    for (const [outputField, inputField] of Object.entries(
      FUND_FIELD_MAPPING,
    )) {
      if (inputField === "default") {
        mappedRow[outputField] = null;
      } else {
        mappedRow[outputField] =
          row[inputField] !== undefined ? row[inputField] : null;
      }
    }

    const client = clientLookup.get(String(row.client_id ?? ""));

    if (client) {
      mappedRow.client_code = client.client_code;
      mappedRow.client_name = client.client_name;
    } else {
      mappedRow.client_code = null;
      mappedRow.client_name = null;
    }

    output.push(mappedRow);
  }

  return output;
}
