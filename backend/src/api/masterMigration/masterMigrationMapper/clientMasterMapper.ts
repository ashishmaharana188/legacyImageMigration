interface Row {
  [key: string]: any;
}

export const CLIENT_FIELD_MAPPING: Record<string, string> = {
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

//Mongo Map

const date = new Date()
  .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
  .toUpperCase();

export const mapClientToMongo = (row: Row) => {
  const addressComponents = (row.address ?? "").split(",");

  return {
    currentStage: 4,
    entryDate: date,
    revisionNo: 2,
    recordStatus: 1,
    status: "A",
    checkerId: "system",
    updateFlag: "0",
    sourceUser: "system",

    agreementDate: {
      update: false,
      value: row.agreement_date,
    },

    clientAddress: {
      address1: {
        update: false,
        value: addressComponents[0]?.trim() ?? "",
      },
      address2: {
        update: false,
        value: addressComponents[1]?.trim() ?? "",
      },
      address3: {
        update: false,
        value:
          addressComponents.length > 2
            ? addressComponents.slice(2).join(", ").trim()
            : "",
      },
      city: {
        update: false,
        value: row.city,
      },
      country: {
        update: false,
        value: row.country,
      },
      pin: {
        update: false,
        value: row.pin,
      },
      state: {
        update: false,
        value: row.state,
      },
    },

    clientCode: row.client_code,

    clientContactDetails: {
      countryDialCode: "",
      landlineNo: {
        update: false,
        value: row.contact_number,
      },
    },

    clientLogoPath: {
      format: "",
      path: row.company_logo,
      size: "",
    },

    clientName: {
      update: false,
      value: row.client_name,
    },

    clientOtherNames: {
      clientOtherCode: row.client_code,
      clientOtherName: {
        update: false,
        value: row.client_name,
      },
    },

    clientType: {
      update: false,
      value: row.type,
    },

    ckycDetails: {
      ckycUserName: {
        update: false,
        value: row.ckyc_username,
      },
      ckycInstCode: {
        update: false,
        value: row.ckyc_institution_code,
      },
      ckycPassword: {
        update: false,
        value: row.ckyc_password,
      },
      ckycUserId: {
        update: false,
        value: row.ckyc_userid,
      },
    },

    domicile: {
      update: false,
      value: row.domicile,
    },

    kraDetails: {
      kraLoginId: {
        update: false,
        value: row.kra_login_id,
      },
      kraName: {
        update: false,
        value: row.kra_type,
      },
      kraPOSCode: {
        update: false,
        value: row.kra_pos_code,
      },
      kraPassword: {
        update: false,
        value: row.kra_password,
      },
      kraUserName: {
        update: false,
        value: row.kra_username,
      },
    },

    taxDetails: {
      pan: {
        update: false,
        value: row.pan,
      },
      taxIdNo: {
        update: false,
        value: row.tin,
      },
    },

    legalEntIdCode: {
      update: false,
      value: row.lei_code,
    },

    legalEntIdCodeValidity: {
      update: false,
      value: row.lei_code_validity,
    },

    trustName: {
      update: false,
      value: row.trust_name,
    },

    tenantId: row.tenant_id ?? null,
  };
};
