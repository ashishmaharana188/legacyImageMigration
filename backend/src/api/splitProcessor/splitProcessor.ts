// splitProcessor.ts
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import winston from "winston";
import { exec } from "child_process";
import util from "util";
import { SplitFileDetail, SplitProgressUpdate } from "./splitProcessorTypes";

const execPromise = util.promisify(exec);

// Helper to extract split count and paths from Python stdout
function extractSplitPaths(
  stdout: string,
  fileName: string,
  outputFolderPath: string,
  logger: winston.Logger
): string[] {
  const match = stdout.match(/Split (\d+) pages successfully/);
  if (match && match[1]) {
    const splitCount = parseInt(match[1], 10);
    logger.info(`Extracted split count: ${splitCount}`);

    const splitFilePaths: string[] = [];
    const fileExt = path.extname(fileName);
    const baseName = path.basename(fileName, fileExt);

    for (let i = 0; i < splitCount; i++) {
      const splitFileName = `${baseName}_${i + 1}${fileExt}`;
      splitFilePaths.push(path.join(outputFolderPath, splitFileName));
    }
    return splitFilePaths;
  } else {
    logger.warn("Could not extract split count from Python stdout.", {
      stdout,
    });
    return [];
  }
}

export async function runPythonFallback(
  filePath: string,
  outputFolderPath: string,
  fileName: string,
  logger: winston.Logger
): Promise<string[]> {
  // UNIFIED PATH: Anchors to the folder containing this executing file
  const pythonScript = path.join(__dirname, "fallBackSplit.py");
  const pythonExecutable = process.env.PYTHON_EXECUTABLE_PATH || "python";

  try {
    logger.info(`Running Python fallback using: ${pythonScript}`);
    const { stdout, stderr } = await execPromise(
      `${pythonExecutable} "${pythonScript}" "${filePath}" "${outputFolderPath}"`
    );

    if (stderr)
      logger.warn(`Python fallback stderr for ${fileName}`, { stderr });
    return extractSplitPaths(stdout, fileName, outputFolderPath, logger);
  } catch (error) {
    logger.error(`Python fallback failed for ${fileName}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function runPythonMuPDF(
  filePath: string,
  outputFolderPath: string,
  fileName: string,
  logger: winston.Logger
): Promise<string[]> {
  // UNIFIED PATH: Anchors to the folder containing this executing file
  const pythonScript = path.join(__dirname, "mupdf_splitter.py");
  const pythonExecutable = process.env.PYTHON_EXECUTABLE_PATH || "python";

  try {
    logger.info(`Running Python MuPDF split using: ${pythonScript}`);
    const { stdout, stderr } = await execPromise(
      `${pythonExecutable} "${pythonScript}" "${filePath}" "${outputFolderPath}"`
    );

    if (stderr) logger.warn(`Python split stderr for ${fileName}`, { stderr });
    return extractSplitPaths(stdout, fileName, outputFolderPath, logger);
  } catch (error) {
    logger.error(`Python split failed for ${fileName}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function performSplit(
  filePath: string,
  outputFolderPath: string,
  logger: winston.Logger,
  progressCallback: (update: SplitProgressUpdate) => void,
  totalSplitFilesGenerated: number,
  splitErrors: number,
  useMuPDF: boolean = false
): Promise<{
  createdSplitFiles: SplitFileDetail[];
  totalSplitFilesGenerated: number;
  splitErrors: number;
}> {
  const createdSplitFiles: SplitFileDetail[] = [];
  const fileName = path.basename(filePath);
  let currentTotalSplitFilesGenerated = totalSplitFilesGenerated;
  let currentSplitErrors = splitErrors;

  let splitSuccessful = false;
  let pagesSplit = 0;

  try {
    if (useMuPDF) {
      const splitFilePaths = await runPythonMuPDF(
        filePath,
        outputFolderPath,
        fileName,
        logger
      );
      pagesSplit = splitFilePaths.length;

      splitFilePaths.forEach((splitPath) => {
        createdSplitFiles.push({ originalPath: filePath, splitPath, page: 0 });
        currentTotalSplitFilesGenerated++;
      });
      splitSuccessful = pagesSplit > 0;
    } else {
      // PDF-Lib or Sharp logic here (omitted for brevity, same as previous logic)
    }
  } catch (err) {
    logger.error(
      `Primary split failed for ${fileName}, attempting fallback...`
    );
  }

  if (!splitSuccessful) {
    try {
      const fallbackPaths = await runPythonFallback(
        filePath,
        outputFolderPath,
        fileName,
        logger
      );
      pagesSplit = fallbackPaths.length;

      fallbackPaths.forEach((splitPath) => {
        createdSplitFiles.push({ originalPath: filePath, splitPath, page: 0 });
        currentTotalSplitFilesGenerated++;
      });
      splitSuccessful = pagesSplit > 0;
    } catch (fallbackErr) {
      currentSplitErrors++;
      logger.error(`Total failure for ${fileName}`);
    }
  }

  return {
    createdSplitFiles,
    totalSplitFilesGenerated: currentTotalSplitFilesGenerated,
    splitErrors: currentSplitErrors,
  };
}
