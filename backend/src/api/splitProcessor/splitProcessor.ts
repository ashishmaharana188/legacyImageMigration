// splitProcessor.ts
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import winston from "winston";
import { exec } from "child_process";
import util from "util";
import { SplitFileDetail, SplitProgressUpdate} from "./splitProcessorTypes"; // Import interfaces

const execPromise = util.promisify(exec);

// Helper to get file extension
function getFileExtension(filePath: string): string {
  return filePath ? path.extname(filePath).toLowerCase() : "";
}

export async function runPythonFallback(
  filePath: string,
  outputFolderPath: string,
  fileName: string,
  logger: winston.Logger
): Promise<string[]> {
  const projectRoot = path.resolve(__dirname, "../../..");
  const pythonScript = path.join(
    projectRoot,
    "backend",
    "services",
    "fallBackSplit.py"
  );
  const pythonExecutable = process.env.PYTHON_EXECUTABLE_PATH || "python";
  try {
    logger.info(
      `Attempting Python fallback for ${fileName} using script: ${pythonScript} and executable: ${pythonExecutable}`
    );
    const { stdout, stderr } = await execPromise(
      `${pythonExecutable} "${pythonScript}" "${filePath}" "${outputFolderPath}"`
    );
    logger.info(`Python fallback succeeded for ${fileName}`, { stdout });
    if (stderr)
      logger.warn(`Python fallback stderr for ${fileName}`, { stderr });

    const match = stdout.match(/Split (\d+) pages successfully/);
    if (match && match[1]) {
      const splitCount = parseInt(match[1], 10);
      logger.info(`Extracted split count from Python fallback: ${splitCount}`);
      const splitFilePaths: string[] = [];
      const fileExt = path.extname(fileName);
      const baseName = path.basename(fileName, fileExt);
      for (let i = 0; i < splitCount; i++) {
        const splitFileName = `${baseName}_${i + 1}${fileExt}`;
        splitFilePaths.push(path.join(outputFolderPath, splitFileName));
      }
      return splitFilePaths;
    } else {
      logger.warn(
        "Could not extract split count from Python fallback stdout.",
        { stdout }
      );
      return [];
    }
  } catch (error) {
    logger.error(`Python fallback failed for ${fileName}`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
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
  const projectRoot = path.resolve(__dirname, "../../..");
  const pythonScript = path.join(
    projectRoot,
    "backend",
    "services",
    "mupdf_splitter.py"
  );
  const pythonExecutable = process.env.PYTHON_EXECUTABLE_PATH || "python";
  try {
    logger.info(
      `Attempting Python split for ${fileName} using script: ${pythonScript} and executable: ${pythonExecutable}`
    );
    const { stdout, stderr } = await execPromise(
      `${pythonExecutable} "${pythonScript}" "${filePath}" "${outputFolderPath}"`
    );
    logger.info(`Python split succeeded for ${fileName}`, { stdout });
    if (stderr)
      logger.warn(`Python split stderr for ${fileName}`, { stderr });

    const match = stdout.match(/Split (\d+) pages successfully/);
    if (match && match[1]) {
      const splitCount = parseInt(match[1], 10);
      logger.info(`Extracted split count from Python script: ${splitCount}`);
      const splitFilePaths: string[] = [];
      const fileExt = path.extname(fileName);
      const baseName = path.basename(fileName, fileExt);
      for (let i = 0; i < splitCount; i++) {
        const splitFileName = `${baseName}_${i + 1}${fileExt}`;
        splitFilePaths.push(path.join(outputFolderPath, splitFileName));
      }
      return splitFilePaths;
    } else {
      logger.warn(
        "Could not extract split count from Python script stdout.",
        { stdout }
      );
      return [];
    }
  } catch (error) {
    logger.error(`Python split failed for ${fileName}`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

export async function performSplit(
  filePath: string,
  outputFolderPath: string,
  logger: winston.Logger,
  progressCallback: (update: SplitProgressUpdate) => void,
  // Removed totalOriginalFilesProcessed and totalExpectedSplits from parameters
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
  const fileExt = getFileExtension(fileName);
  let currentTotalSplitFilesGenerated = totalSplitFilesGenerated;
  let currentSplitErrors = splitErrors;

  let fileBuffer: Buffer;
  try {
    fileBuffer = await fs.readFile(filePath);
  } catch (err) {
    logger.error(`Failed to read file ${filePath}`, { error: err });
    currentSplitErrors++; // Increment error as file read failed
    progressCallback({
      type: "splitProgressUpdate",
      totalSplitFilesGenerated: currentTotalSplitFilesGenerated,
      splitErrors: currentSplitErrors,
      currentlySplittingFiles: fileName,
      status: `Error reading file: ${fileName}`,
    });
    return {
      createdSplitFiles: [],
      totalSplitFilesGenerated: currentTotalSplitFilesGenerated,
      splitErrors: currentSplitErrors,
    };
  }

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
        createdSplitFiles.push({
          originalPath: filePath,
          splitPath: splitPath,
          page: 0, // Page number is not critical here as we get it from the script output
        });
        currentTotalSplitFilesGenerated++;
      });
      splitSuccessful = pagesSplit > 0;

      progressCallback({
        type: "splitProgressUpdate",
        totalSplitFilesGenerated: currentTotalSplitFilesGenerated,
        splitErrors: currentSplitErrors,
        currentlySplittingFiles: fileName,
        status: `Split file with MuPDF: ${fileName}`,
      });
    } else if (fileExt === ".pdf") {
      const pdfDoc = await PDFDocument.load(fileBuffer);
      const numPages = pdfDoc.getPages().length;
      pagesSplit = numPages;
      for (let i = 0; i < numPages; i++) {
        const originalFileExt = path.extname(fileName);
        const baseName = path.basename(fileName, originalFileExt);
        const subDoc = await PDFDocument.create();
        const [copiedPage] = await subDoc.copyPages(pdfDoc, [i]);
        subDoc.addPage(copiedPage);
        const pdfBytes = await subDoc.save();
        const splitFileName = `${baseName}_${i + 1}${originalFileExt.toLowerCase()}`;
        const outputFilePath = path.join(outputFolderPath, splitFileName);
        await fs.writeFile(outputFilePath, pdfBytes);
        logger.info(`Saved: ${outputFilePath}`);
        createdSplitFiles.push({
          originalPath: filePath,
          splitPath: outputFilePath,
          page: i + 1,
        });
        currentTotalSplitFilesGenerated++;
        progressCallback({
          type: "splitProgressUpdate",
          totalSplitFilesGenerated: currentTotalSplitFilesGenerated,
          splitErrors: currentSplitErrors,
          currentlySplittingFiles: splitFileName,
          status: `Generated split file: ${splitFileName}`,
        });
      }
      splitSuccessful = pagesSplit > 0;
    } else if (fileExt === ".tif" || fileExt === ".tiff") {
      const metadata = await sharp(fileBuffer).metadata();
      logger.info(`Splitting TIFF ${fileName}`, { metadata });
      const totalPages = metadata.pages || 1;
      pagesSplit = totalPages;
      for (let i = 0; i < totalPages; i++) {
        const splitImage = await sharp(fileBuffer, { page: i }).toBuffer();
        const splitFileName = `${path.basename(fileName, fileExt)}_${i + 1}${fileExt}`;
        const outputFilePath = path.join(outputFolderPath, splitFileName);
        await fs.writeFile(outputFilePath, splitImage);
        logger.info(`Saved: ${outputFilePath}`);
        createdSplitFiles.push({
          originalPath: filePath,
          splitPath: outputFilePath,
          page: i + 1,
        });
        currentTotalSplitFilesGenerated++;
        progressCallback({
          type: "splitProgressUpdate",
          totalSplitFilesGenerated: currentTotalSplitFilesGenerated,
          splitErrors: currentSplitErrors,
          currentlySplittingFiles: splitFileName,
          status: `Generated split file: ${splitFileName}`,
        });
      }
      splitSuccessful = pagesSplit > 0;
    } else {
      logger.warn(`Skipping unsupported file format: ${fileName}`);
      // This is an error if no split happens
    }
  } catch (err) {
    logger.error(`Error processing ${fileName} with primary method`, { error: err });
    // Attempt fallback if primary method fails
  }

  if (!splitSuccessful) {
    try {
      const fallbackSplitFilePaths = await runPythonFallback(
        filePath,
        outputFolderPath,
        fileName,
        logger
      );
      pagesSplit = fallbackSplitFilePaths.length;

      fallbackSplitFilePaths.forEach((splitPath) => {
        createdSplitFiles.push({
          originalPath: filePath,
          splitPath: splitPath,
          page: 0,
        });
        currentTotalSplitFilesGenerated++;
      });
      splitSuccessful = pagesSplit > 0;

              progressCallback({
                type: "splitProgressUpdate",
                totalSplitFilesGenerated: currentTotalSplitFilesGenerated,
                splitErrors: currentSplitErrors,
                currentlySplittingFiles: fileName,
                          status: `Generated a fallback split file.`,
                        });    } catch (fallbackErr) {
      logger.error(`Fallback also failed for ${fileName}`, {
        error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
        stack: fallbackErr instanceof Error ? fallbackErr.stack : undefined,
      });
      // If both primary and fallback fail, then it's a true error
      currentSplitErrors++;
      progressCallback({
        type: "splitProgressUpdate",
        totalSplitFilesGenerated: currentTotalSplitFilesGenerated,
        splitErrors: currentSplitErrors,
        currentlySplittingFiles: fileName,
        status: `Fallback failed for file: ${fileName}`,
      });
    }
  }

  // If after all attempts, no pages were split, increment splitErrors
  if (!splitSuccessful && pagesSplit === 0) {
    currentSplitErrors++;
    progressCallback({
      type: "splitProgressUpdate",
      totalSplitFilesGenerated: currentTotalSplitFilesGenerated,
      splitErrors: currentSplitErrors,
      currentlySplittingFiles: fileName,
      status: `Failed to split file: ${fileName}`,
    });
  }

  return {
    createdSplitFiles,
    totalSplitFilesGenerated: currentTotalSplitFilesGenerated,
    splitErrors: currentSplitErrors,
  };
}
