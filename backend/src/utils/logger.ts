import winston from "winston";
import path from "path";
import fs from "fs";

// Ensure the root logs directory exists
const logRoot = path.join(__dirname, "../../../logs");
if (!fs.existsSync(logRoot)) {
  fs.mkdirSync(logRoot, { recursive: true });
}

// 1. Sanitize: Prevent secrets from leaking
const sanitize = winston.format((info) => {
  if (info.metadata && typeof info.metadata === "object") {
    const metadata = info.metadata as Record<string, any>;
    const sensitiveKeys = [
      "credentials",
      "accessKeyId",
      "secretAccessKey",
      "sessionToken",
      "authorization",
    ];
    sensitiveKeys.forEach((key) => {
      if (key in metadata) {
        delete metadata[key];
      }
    });
  }
  return info;
});

// 2. Strict Console Filter: The "Clean Terminal" Logic
// This ensures only 'warn', 'error', or explicitly marked logs appear in the terminal.
const consoleFilter = winston.format((info) => {
  // Always allow errors and warnings
  if (info.level === "error" || info.level === "warn") {
    return info;
  }

  // Allow info logs ONLY if they have the { console: true } tag
  // Checks both the metadata object and the root info object
  if (
    (info.metadata && (info.metadata as any).console) ||
    (info as any).console
  ) {
    return info;
  }

  // Otherwise, silence it (drop from console transport)
  return false;
});

/**
 * Creates a logger dedicated to a specific feature.
 * Output:
 * - logs/<featureName>/logs.txt (All details)
 * - logs/<featureName>/error.txt (Errors only)
 * - Console (Minimal status updates only)
 */
export const createFeatureLogger = (featureName: string) => {
  const featureDir = path.join(logRoot, featureName);

  // Ensure feature folder exists
  if (!fs.existsSync(featureDir)) {
    fs.mkdirSync(featureDir, { recursive: true });
  }

  return winston.createLogger({
    level: "info", // Captures info and above for files
    format: winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.errors({ stack: true }),
      winston.format.metadata({
        fillExcept: ["message", "level", "timestamp"],
      }),
      sanitize(),
      winston.format.json()
    ),
    transports: [
      // 1. Feature Specific Log (Everything)
      new winston.transports.File({
        filename: path.join(featureDir, "logs.txt"),
        level: "info",
      }),

      // 2. Feature Specific Error Log (Errors Only)
      new winston.transports.File({
        filename: path.join(featureDir, "error.txt"),
        level: "error",
      }),

      // 3. Console (Silent by default)
      new winston.transports.Console({
        level: "info",
        format: winston.format.combine(
          consoleFilter(),
          winston.format.colorize(),
          winston.format.printf(({ level, message }) => {
            return `[${featureName}] ${level}: ${message}`;
          })
        ),
      }),
    ],
  });
};

// Default export for general app usage
export default createFeatureLogger("app-general");
