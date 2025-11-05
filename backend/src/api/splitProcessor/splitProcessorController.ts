import { SplitProcessorWrapper } from "./splitProcessorWrapper";
import { Request, Response } from "express";
import logger from "../../../services/logger";

class SplitFilesController {
  private splitProcessorWrapper: SplitProcessorWrapper;

  constructor() {
    this.splitProcessorWrapper = new SplitProcessorWrapper();
  }

  async splitFiles(req: Request, res: Response) {
    try {
      logger.info({
        category: "api-calls",
        function: "splitFiles",
        message: "Initiating file splitting process.",
      });
      const result = await this.splitProcessorWrapper.splitFiles();
      logger.debug({
        category: "responses",
        function: "splitFiles",
        message: "Files split successfully",
        splitSummary: result.summary,
      });
      res.status(200).json({
        statusCode: 200,
        message: "Files split successfully",
        splitSummary: result.summary,
      });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "splitFiles",
        message: "Failed to split files",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to split files",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async splitFilesWithMuPDF(req: Request, res: Response) {
    try {
      logger.info({
        category: "api-calls",
        function: "splitFilesWithMuPDF",
        message: "Initiating file splitting process with MuPDF.",
      });
      const result = await this.splitProcessorWrapper.splitFilesWithMuPDF();
      logger.debug({
        category: "responses",
        function: "splitFilesWithMuPDF",
        message: "Files split successfully with MuPDF",
        splitSummary: result.summary,
      });
      res.status(200).json({
        statusCode: 200,
        message: "Files split successfully with MuPDF",
        splitSummary: result.summary,
      });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "splitFilesWithMuPDF",
        message: "Failed to split files with MuPDF",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to split files with MuPDF",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export const splitFilesController = new SplitFilesController();
