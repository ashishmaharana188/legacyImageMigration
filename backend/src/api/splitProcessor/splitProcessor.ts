import fs from "fs/promises";
import path from "path";
import winston from "winston";
import { execFile } from "child_process";
import util from "util";
import { SplitFileDetail, SplitProgressUpdate } from "./splitProcessorTypes";

const execFilePromise = util.promisify(execFile);

// Helper to extract split count and paths from Python stdout
function extractSplitPaths(
  stdout: string,
  fileName: string,
  outputFolderPath: string,
  logger: winston.Logger,
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

// Our single, unified high-speed Python execution function
export async function runPythonMuPDF(
  filePath: string,
  outputFolderPath: string,
  fileName: string,
  logger: winston.Logger,
): Promise<string[]> {
  const pythonScript = path.join(__dirname, "mupdf_splitter.py");
  const pythonExecutable = process.env.PYTHON_EXECUTABLE_PATH || "python";

  try {
    // execFile talks directly to python.exe. No shell means no freezing.
    // We enforce an 8-second timeout to kill zombie loops, and removed the buffer.
    const { stdout } = await execFilePromise(
      pythonExecutable,
      [pythonScript, filePath, outputFolderPath],
      {
        timeout: 8000,
      },
    );
    return extractSplitPaths(stdout, fileName, outputFolderPath, logger);
  } catch (error: any) {
    // Blanket throw - we do not care about the specific tracebacks anymore
    throw new Error("Extraction failed or timed out");
  }
}

export async function performSplit(
  filePath: string,
  outputFolderPath: string,
  logger: winston.Logger,
  progressCallback: (update: SplitProgressUpdate) => void,
  totalSplitFilesGenerated: number,
  splitErrors: number,
  useMuPDF: boolean = true,
): Promise<{
  createdSplitFiles: SplitFileDetail[];
  totalSplitFilesGenerated: number;
  splitErrors: number;
}> {
  const createdSplitFiles: SplitFileDetail[] = [];
  const fileName = path.basename(filePath);
  let currentTotalSplitFilesGenerated = totalSplitFilesGenerated;
  let currentSplitErrors = splitErrors;

  const processPaths = (paths: string[]) => {
    paths.forEach((splitPath) => {
      createdSplitFiles.push({ originalPath: filePath, splitPath, page: 0 });
      currentTotalSplitFilesGenerated++;

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
    const splitFilePaths = await runPythonMuPDF(
      filePath,
      outputFolderPath,
      fileName,
      logger,
    );

    const splitSuccessful = processPaths(splitFilePaths);

    if (!splitSuccessful) {
      throw new Error("No pages extracted");
    }
  } catch (err: any) {
    // [BULLDOZER MODE] Instantly catch, tally the error, skip, and move on.
    currentSplitErrors++;

    // Log a clean, single-line skip message instead of a giant error block
    logger.warn(`Skipped unreadable file: ${fileName}`);

    progressCallback({
      type: "splitProgressUpdate",
      taskKey: "splitFiles",
      totalSplitFilesGenerated: currentTotalSplitFilesGenerated,
      splitErrors: currentSplitErrors,
      currentlySplittingFiles: fileName,
      message: `Skipped: ${fileName}`,
      status: "Error",
    });
  }

  // Always return so the wrapper's loop continues seamlessly
  return {
    createdSplitFiles,
    totalSplitFilesGenerated: currentTotalSplitFilesGenerated,
    splitErrors: currentSplitErrors,
  };
}
