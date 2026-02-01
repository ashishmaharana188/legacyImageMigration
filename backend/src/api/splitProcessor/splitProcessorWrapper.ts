import fs from "fs/promises";
import path from "path";
import { performSplit } from "./splitProcessor";
import logger from "../../utils/logger";
import { SplitResult, SplitProgressUpdate } from "./splitProcessorTypes";
import { webSocketService } from "../../utils/webSocketService";

export class SplitProcessorWrapper {
  private readonly uploadDir: string;
  private readonly outputDir: string;

  constructor() {
    // Define standard paths (Adjust if your config differs)
    this.uploadDir = path.join(__dirname, "../../../uploads");
    this.outputDir = path.join(__dirname, "../../../split_output");
  }

  // Helper to ensure directories exist
  private async ensureDirectories() {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
    try {
      await fs.access(this.outputDir);
    } catch {
      await fs.mkdir(this.outputDir, { recursive: true });
    }
  }

  /**
   * The Standard Split Logic
   */
  async splitFiles(): Promise<SplitResult> {
    return this.processSplit(false); // false = Use Standard Splitter
  }

  /**
   * The MuPDF Split Logic
   */
  async splitFilesWithMuPDF(): Promise<SplitResult> {
    return this.processSplit(true); // true = Use MuPDF
  }

  /**
   * Unified Processing Logic to avoid duplication
   */
  private async processSplit(useMuPDF: boolean): Promise<SplitResult> {
    await this.ensureDirectories();

    const files = await fs.readdir(this.uploadDir);
    // Filter for PDFs only
    const pdfFiles = files.filter((f) => f.toLowerCase().endsWith(".pdf"));

    let totalSplitFilesGenerated = 0;
    let splitErrors = 0;
    // Estimate total pages? Difficult without reading all.
    // We set a placeholder or sum up file counts as a proxy for now.
    const totalFilesToProcess = pdfFiles.length;

    // [CRITICAL] The Live Progress Callback
    const handleProgress = (update: SplitProgressUpdate) => {
      // Inject global stats that the worker might not know
      const enrichedUpdate = {
        ...update,
        // If we don't know total pages, we might map 'totalExpected' to file count or update dynamically
        totalExpectedPagesFromCsv:
          update.totalExpectedPagesFromCsv || totalFilesToProcess * 1,
      };

      // Broadcast to Frontend
      webSocketService.broadcast(enrichedUpdate);
    };

    for (const file of pdfFiles) {
      const filePath = path.join(this.uploadDir, file);

      // Call the worker with the NEW signature
      const result = await performSplit(
        filePath,
        this.outputDir,
        logger,
        handleProgress, // <--- Passing the "Phone Line" to the worker
        totalSplitFilesGenerated,
        splitErrors,
        useMuPDF
      );

      totalSplitFilesGenerated = result.totalSplitFilesGenerated;
      splitErrors = result.splitErrors;
    }

    // Final Completion Broadcast
    webSocketService.broadcast({
      type: "splitProgressComplete",
      taskKey: "splitFiles",
      totalSplitFilesGenerated,
      splitErrors,
      totalExpectedPagesFromCsv: totalSplitFilesGenerated, // 100%
      status: "Completed",
    });

    return {
      summary: {
        totalSplitFilesGenerated,
        splitErrors,
        totalExpectedPagesFromCsv: totalSplitFilesGenerated, // Final sync
      },
    };
  }
}
