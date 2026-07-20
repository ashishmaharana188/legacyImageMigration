import { Request, Response } from "express";
import { getCurrentEnvironment, switchEnvironment } from "./dbConnect";

import express from "express";

const AVAILABLE_ENVIRONMENTS = [
  { id: "development", label: "Development" },
  { id: "uat", label: "UAT" },
  { id: "production", label: "Production" },
];

export const getEnvironment = async (_req: Request, res: Response) => {
  res.status(200).json({
    current: getCurrentEnvironment(),
    available: AVAILABLE_ENVIRONMENTS,
  });
};

export const setEnvironment = async (req: Request, res: Response) => {
  try {
    const { environment } = req.body;

    if (!environment) {
      return res.status(400).json({
        status: "error",
        message: "environment is required",
      });
    }

    await switchEnvironment(environment);

    res.status(200).json({
      status: "success",
      message: `Environment switched to ${environment}`,
      current: getCurrentEnvironment(),
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to switch environment",
    });
  }
};

const router = express.Router();

router.get("/environment", getEnvironment);
router.post("/environment", setEnvironment);

export default router;
