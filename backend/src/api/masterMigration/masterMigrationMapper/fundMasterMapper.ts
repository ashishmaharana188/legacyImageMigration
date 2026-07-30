interface Row {
  [key: string]: any;
}

export const FUND_FIELD_MAPPING: Record<string, string> = {
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
}

//mongo mapping

const date = new Date()
  .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
  .toUpperCase();

export const mapFundToMongo = (row: Row) => {
  return {
    clientCode: row.client_code,

    clientName: row.client_name,

    sapId: {
      update: false,
      value: row.sap_id,
    },

    currentStage: 7,

    entryDate: date,

    defaulterPenaltyApplicableOrNotApplicable: {
      update: false,
      value: row.defaulter_penalty,
    },

    distributionFrequency: {
      update: false,
      value: row.distribution_frequency,
    },

    dormantDate: {
      update: false,
      value: row.dormant_date,
    },

    forexSource: {
      update: false,
      value: row.forex_source,
    },

    fundAccountantContactCountryCode: {
      update: false,
      value: "",
    },

    revisionNo: 3,

    recordStatus: 1,

    status: "A",

    sourceUser: "system",

    auditorId: "system",

    updateFlag: "0",

    fundCode: row.fund_code,

    fundFrom: {
      update: false,
      value: row.fund_from,
    },

    fundName: {
      update: false,
      value: row.fund_name,
    },

    fundShortName: {
      update: false,
      value: row.fund_short_name,
    },

    fundDomicile: {
      update: false,
      value: row.fund_domicile,
    },

    fundBusinessType: {
      update: false,
      value: row.fund_business_type,
    },

    serviceModel: {
      update: false,
      value: [row.service_model],
    },

    fundCategory: {
      update: false,
      value: row.fund_category,
    },

    fundSubCategory: {
      update: false,
      value: row.fund_sub_category,
    },

    fundNature: {
      update: false,
      value: row.fund_nature,
    },

    fundFaceValue: {
      update: false,
      value: row.fund_face_value,
    },

    fundCurrency: {
      update: false,
      value: row.fund_currency,
    },

    fundPeriodType: {
      update: false,
      value: row.fund_period,
    },

    fundPeriodValue: {
      update: false,
      value: "",
    },

    fundRegistrationNumber: {
      update: false,
      value: row.fund_registration_number,
    },

    fundPanOrTin: {
      update: false,
      value: row.pan_or_tin,
    },

    gstin: {
      update: false,
      value: row.gstin,
    },

    fundISINNumber: {
      update: false,
      value: row.fund_isin_number,
    },

    fundDepositoryType: {
      update: false,
      value: row.fund_depository_type,
    },

    fundDPID: {
      update: false,
      value: row.fund_dp_id,
    },

    fundClientID: {
      update: false,
      value: row.fund_client_id,
    },
    fundSpecificStartDate: {
      update: false,
      value: row.fund_start_date1,
    },

    fundInitialContributionStartDate: {
      update: false,
      value: row.fund_initial_contribution_start_date,
    },

    fundInitialContributionCloseDate: {
      update: false,
      value: row.fund_initial_contribution_close_date,
    },

    fundEndDate: {
      update: false,
      value: row.fund_end_date,
    },

    fundMaturityDate: {
      update: false,
      value: row.fund_maturity_date,
    },

    fundMaxInvestors: {
      update: false,
      value: row.fund_max_investors,
    },

    fundInitialContributionAmount: {
      update: false,
      value: row.fund_initial_contribution_amount,
    },

    fundInitialContributionPercentage: {
      update: false,
      value: row.fund_initial_contribution_percentage,
    },

    fundSizeCorpus: {
      update: false,
      value: row.fund_size,
    },

    fundSponsorName: {
      update: false,
      value: row.fund_sponsor_name,
    },

    fundInvestmentManager: {
      update: false,
      value: row.fund_investment_manager,
    },

    fundTrusteeName: {
      update: false,
      value: row.fund_trustee_name,
    },

    taxAdvisorName: {
      update: false,
      value: row.tax_advisor_name,
    },

    legalAdvisorName: {
      update: false,
      value: row.legal_advisor_name,
    },

    fundCustodianCode: {
      update: false,
      value: row.fund_custodian_code,
    },

    fundAccountantName: {
      update: false,
      value: row.fund_accountant_name,
    },

    fundAccountantEmail: {
      update: false,
      value: row.fund_accountant_email,
    },

    fundAccountantContactNumber: {
      update: false,
      value: row.fund_accountant_contact_number,
    },

    transferAgentName: {
      update: false,
      value: row.transfer_agent_name,
    },

    transferAgentAccountantEmail: {
      update: false,
      value: row.transfer_agent_accountant_email,
    },

    transferAgentContactCountryCode: {
      update: false,
      value: "",
    },

    transferAgentContactNumber: {
      update: false,
      value: row.transfer_agent_contact_number,
    },

    fundRTACode: {
      update: false,
      value: row.fund_rta_code,
    },

    fundPreviousDate: {
      update: false,
      value: row.fund_previous_date,
    },

    fundCurrentDate: {
      update: false,
      value: row.fund_current_date,
    },

    fundNextDate: {
      update: false,
      value: row.fund_next_date,
    },

    fundPreviousYearEnd: {
      update: false,
      value: row.fund_previous_year_end,
    },

    fundCurrentYearEnd: {
      update: false,
      value: row.fund_current_year_end,
    },

    prevNAVDate: {
      update: false,
      value: row.prev_nav_date_,
    },

    navFrequency: {
      update: false,
      value: row.nav_frequency,
    },

    nextNAVDate: {
      update: false,
      value: row.next_nav_date,
    },

    navPubFrequency: {
      update: false,
      value: row.nav_publish_type,
    },

    prevNAVPubDate: {
      update: false,
      value: row.prev_nav_pub_date,
    },

    prevNAVPubFrequency: {
      update: false,
      value: row.nav_pub_frequency,
    },

    nextNAVPubDate: {
      update: false,
      value: row.next_nav_pub_date,
    },
    fundPLCompMethod: {
      update: false,
      value: row.fund_pl_comp_method,
    },

    valuationSequence: {
      update: false,
      value: row.valuation_sequence,
    },

    unitDecimals: {
      update: false,
      value: row.unit_decimals,
    },

    roundMethod: {
      update: false,
      value: row.round_method_,
    },

    roundDecimals: {
      update: false,
      value: row.round_decimals,
    },

    fundDDNoticePeriod: {
      update: false,
      value: row.fund_dd_notice_period,
    },

    fundDDPenaltyCharges: {
      update: false,
      value: row.fund_dd_penalty_charges,
    },

    fundTopupTreatment: {
      update: false,
      value: row.fund_topup_treatment,
    },

    fundDDTreatment: {
      update: false,
      value: row.fund_dd_treatment,
    },

    fundManagementFee: {
      update: false,
      value: row.fund_management_fee,
    },

    fundAdditionalFee: {
      update: false,
      value: row.fund_additional_fee,
    },

    setupFee: {
      update: false,
      value: row.setup_fee_percentage,
    },

    fundTrusteeFee: {
      update: false,
      value: row.fund_trustee_fee,
    },

    operatingExpensesApplicableOrNotApplicable: {
      update: false,
      value: row.operating_expenses,
    },

    goodsAndServiceTax: {
      update: false,
      value: row.gst_percentage,
    },

    fundCommitmentApplicability: {
      update: false,
      value: row.fund_commitment_applicability_,
    },

    preferredRateOfReturnApplicableOrNotApplicable: {
      update: false,
      value: row.preferred_rate_of_return,
    },

    hurdleRate: {
      update: false,
      value: row.hurdle_rate_,
    },

    highWaterMark: {
      update: false,
      value: row.high_water_mark,
    },

    hurdleStartDate: {
      update: false,
      value: row.hurdle_start_date,
    },

    gpSharingRation: {
      update: false,
      value: row.gp_sharing_ration,
    },

    navRatioMethod: {
      update: false,
      value: row.nav_ratio_method,
    },

    isActive: {
      update: false,
      value: row.is_active,
    },

    isDormant: {
      update: false,
      value: row.dormant_flag,
    },

    fundStampDutyBourne: {
      update: false,
      value: row.fund_stamp_duty_bourne,
    },

    navApplicableMethod: {
      update: false,
      value: row.nav_applicable_method,
    },

    navApplicableTransactions: {
      update: false,
      value: row.nav_applicable_transactions,
    },

    amountDecimals: {
      update: false,
      value: row.amount_decimals,
    },

    navDecimals: {
      update: false,
      value: row.nav_decimals,
    },

    ppmCopyApproval: {
      update: false,
      value: [
        {
          format: "",
          name: "",
          path: "",
          size: "",
        },
      ],
    },

    autoSwitchFlag: {
      update: false,
      value: row.auto_switch_flag || false,
    },

    leiCode: {
      update: false,
      value: row.lei_code,
    },

    leiExpiryDate: {
      update: false,
      value: row.lei_expiry_date,
    },
  };
};
