// backend/src/api/imageDataTransfer/imageDataTransferTypes.ts


export interface SqlLog {
  row: number;
  status: "error" | "updated" | "info" | "success" | "executed";
  message: string;
  sql?: string;
}
