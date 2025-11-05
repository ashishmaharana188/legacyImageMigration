import { Request, Response } from "express";
import { spawn } from "child_process";
import logger from "../../utils/logger"
import path from "path";
import { processExcelFile as wrapperProcessExcelFile } from "./uploadProcessorWrapper";

class UploadProcessorController {
  async processExcelFile(req: Request, res: Response) {
    try {
      logger.info({
        category: "api-calls",
        function: "processExcelFile",
        message: `Initiating Excel file processing for: ${req.file?.originalname}`,
      });
      if (!req.file) {
        logger.warn({
          category: "api-calls",
          function: "processExcelFile",
          message: "No file uploaded for Excel processing.",
        });
        return res
          .status(400)
          .json({ statusCode: 400, error: "No file uploaded" });
      }
      const result = await wrapperProcessExcelFile(req.file.path);
      logger.debug({
        category: "responses",
        function: "processExcelFile",
        message: "Excel file processed successfully",
        originalFile: req.file.originalname,
        processedFile: result.outputFileName,
      });
      res.status(200).json({
        statusCode: 200,
        message: "File processed successfully",
        originalFile: req.file!.originalname,
        processedFile: result.outputFileName,
        summary: result.summary,
        downloadUrl: `/download/${result.outputFileName}`
      });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "processExcelFile",
        message: "Failed to process Excel file",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to process file",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async runFallback(req: Request, res: Response) {
    try {
      if (!req.file) {
        logger.warn({
          category: "api-calls",
          function: "runFallback",
          message: "No file uploaded for fallback processing.",
        });
        return res
          .status(400)
          .json({ statusCode: 400, error: "No file uploaded" });
      }
      logger.info({
        category: "api-calls",
        function: "runFallback",
        message: `Running fallback for file: ${req.file!.originalname}`,
      });

      const pythonScriptPath = path.resolve(
        __dirname,
        "..",
        "..",
        "..",
        "services",
        "fallback_processor.py"
      );
      const excelFilePath = req.file!.path;
      const pythonExecutable = process.env.PYTHON_EXECUTABLE_PATH || "python";

      const childProcess = spawn(pythonExecutable, [
        pythonScriptPath,
        excelFilePath,
      ]);

      childProcess.stdout.on("data", (data) => {
        logger.debug({
          category: "task-steps",
          function: "runFallback",
          message: `Fallback script stdout: ${data.toString().trim()}`,
        });
      });

      childProcess.stderr.on("data", (data) => {
        logger.error({
          category: "task-steps",
          function: "runFallback",
          message: `Fallback script stderr: ${data.toString().trim()}`,
        });
      });

      childProcess.on("close", (code) => {
        if (code === 0) {
          logger.debug({
            function: "runFallback",
            message: "Fallback process completed successfully",
            originalFile: req.file!.originalname,
          });
          res.status(200).json({
            statusCode: 200,
            message: "Fallback process completed successfully",
            originalFile: req.file!.originalname,
          });
        } else {
          logger.error({
            category: "api-calls",
            function: "runFallback",
            message: `Fallback script exited with code ${code}`,
            originalFile: req.file!.originalname,
          });
          res.status(500).json({
            statusCode: 500,
            error: `Fallback script exited with code ${code}`,
          });
        }
      });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "runFallback",
        message: "Fallback processing error",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to process fallback",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export const uploadProcessorController = new UploadProcessorController();
