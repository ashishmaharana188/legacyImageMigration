import fs from "fs/promises";
import path from "path";
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
    const splitFilePaths: string[] = [];
    const fileExt = path.extname(fileName);
    const baseName = path.basename(fileName, fileExt);

    for (let i = 0; i < splitCount; i++) {
      const splitFileName = `${baseName}_${i + 1}${fileExt}`;
      splitFilePaths.push(path.join(outputFolderPath, splitFileName));
    }
    return splitFilePaths;
  } else {
    return [];
  }
}

export async function runPythonFallback(
  filePath: string,
  outputFolderPath: string,
  fileName: string,
  logger: winston.Logger
): Promise<string[]> {
  const pythonScript = path.join(__dirname, "fallBackSplit.py");
  const pythonExecutable = process.env.PYTHON_EXECUTABLE_PATH || "python";

  try {
    const { stdout, stderr } = await execPromise(
      `${pythonExecutable} "${pythonScript}" "${filePath}" "${outputFolderPath}"`
    );
    return extractSplitPaths(stdout, fileName, outputFolderPath, logger);
  } catch (error) {
    throw error;
  }
}

export async function runPythonMuPDF(
  filePath: string,
  outputFolderPath: string,
  fileName: string,
  logger: winston.Logger
): Promise<string[]> {
  const pythonScript = path.join(__dirname, "mupdf_splitter.py");
  const pythonExecutable = process.env.PYTHON_EXECUTABLE_PATH || "python";

  try {
    const { stdout, stderr } = await execPromise(
      `${pythonExecutable} "${pythonScript}" "${filePath}" "${outputFolderPath}"`
    );
    return extractSplitPaths(stdout, fileName, outputFolderPath, logger);
  } catch (error) {
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

  const processPaths = (paths: string[]) => {
    paths.forEach((splitPath) => {
      createdSplitFiles.push({ originalPath: filePath, splitPath, page: 0 });
      currentTotalSplitFilesGenerated++;

      // [CRITICAL] Reporting every single file to the callback
      // The Wrapper will decide when to throttle/broadcast
      progressCallback({
        type: "splitProgressUpdate",
        taskKey: "splitFiles",
        totalSplitFilesGenerated: currentTotalSplitFilesGenerated,
        splitErrors: currentSplitErrors,
        currentlySplittingFiles: fileName,
        message: `Generated: ${path.basename(splitPath)}`,
        status: "Processing",
      });
    });
    return paths.length > 0;
  };

  try {
    if (useMuPDF) {
      const splitFilePaths = await runPythonMuPDF(
        filePath,
        outputFolderPath,
        fileName,
        logger
      );
      splitSuccessful = processPaths(splitFilePaths);
    }
  } catch (err) {
    logger.warn(`Primary split failed for ${fileName}, attempting fallback...`);
  }

  if (!splitSuccessful) {
    try {
      const fallbackPaths = await runPythonFallback(
        filePath,
        outputFolderPath,
        fileName,
        logger
      );
      splitSuccessful = processPaths(fallbackPaths);
    } catch (fallbackErr) {
      currentSplitErrors++;
      logger.error(`Total failure for ${fileName}`);

      progressCallback({
        type: "splitProgressUpdate",
        taskKey: "splitFiles",
        totalSplitFilesGenerated: currentTotalSplitFilesGenerated,
        splitErrors: currentSplitErrors,
        currentlySplittingFiles: fileName,
        message: `Failed to split: ${fileName}`,
        status: "Error",
      });
    }
  }

  return {
    createdSplitFiles,
    totalSplitFilesGenerated: currentTotalSplitFilesGenerated,
    splitErrors: currentSplitErrors,
  };
}
