// backend/src/api/imageDataTransfer/imageDataTransferTypes.ts

import mongoose from "mongoose";

export interface SqlLog {
  row: number;
  status: "success" | "error" | "executed" | "updated";
  message: string;
  sql?: string;
}


