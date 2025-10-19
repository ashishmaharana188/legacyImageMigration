import { BadRow } from "./uploadProcessorType";

export const parseBadRowsCsv = (csvString: string): BadRow[] => {
  const lines = csvString.trim().split('\n');
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim());
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: BadRow = {
          rowNumber: values[headers.indexOf("Row Number")] || "",
          id_fund: values[headers.indexOf("ID Fund")] || "",
          id_trtype: values[headers.indexOf("ID Trtype")] || "",
          id_ihno: values[headers.indexOf("ID IHNO")] || "",
          id_path: values[headers.indexOf("ID Path")] || "",
          id_acno: values[headers.indexOf("ID ACNO")] || "",
          page_count_status: values[headers.indexOf("Page Count Status")] || "",
        };
        return row;
      });  return data;
};
