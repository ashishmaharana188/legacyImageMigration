// stagingValidator.ts

export interface ValidationResult {
  status: "success" | "error";
  message: string;
}

interface Row {
  [key: string]: any;
}

const MANDATORY_FIELDS: Record<string, string[]> = {
  class_map: [
    "client_code",
    "client_name",
    "fund_code",
    "fund_name",
    "plan_code",
    "plan_name",
    "class_code",
    "class_name",
    "class_category",
    "min_amt",
    "max_amt",
    "is_active",
    "series_class",
  ],

  client_map: ["client_code", "client_name"],

  fund_scheme_map: [
    "fund_business_type",
    "fund_currency",
    "fund_nature",
    "fund_domicile",
    "fund_size",
    "fund_stamp_duty_bourne",
    "fund_category",
    "fund_sub_category",
    "gst_percentage",
    "service_model",
    "is_active",
  ],

  bank_map: [
    "client_code",
    "client_name",
    "bank_name",
    "bank_code",
    "ifsc_code",
    "currency",
    "swift_code",
    "corporate_id",
    "branch_name",
    "city",
    "fund_code",
    "fund_name",
    "bank_account_name",
    "bank_account_number",
    "account_type",
    "ownership_type",
    "is_active",
  ],

  contact_map: [
    // add later
  ],

  plan_map: [
    // add later
  ],

  load_map: [
    // add later
  ],
};

const validateMandatoryFields = (
  rows: Row[],
  mandatoryFields: string[],
): ValidationResult => {
  const errors: string[] = [];

  rows.forEach((row, rowIndex) => {
    const missingFields = mandatoryFields.filter((field) => {
      const value = row[field];

      return (
        value === undefined || value === null || String(value).trim() === ""
      );
    });

    if (missingFields.length > 0) {
      errors.push(
        `Row ${rowIndex + 2}: Missing mandatory field(s): ${missingFields.join(
          ", ",
        )}`,
      );
    }
  });

  if (errors.length > 0) {
    return {
      status: "error",
      message: errors.join("\n"),
    };
  }

  return {
    status: "success",
    message: "Mandatory field validation passed.",
  };
};

export const validateStagingData = (
  stagingTable: string,
  rows: Row[],
): ValidationResult => {
  const mandatoryFields = MANDATORY_FIELDS[stagingTable];

  if (!mandatoryFields) {
    return {
      status: "success",
      message: "No validator configured.",
    };
  }

  return validateMandatoryFields(rows, mandatoryFields);
};
