import winston from "winston";
import path from "path";

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

// 2. Console Filter: The "Clean Terminal" Logic
// This ensures only 'warn', 'error', or explicitly marked logs appear in the terminal.
const consoleFilter = winston.format((info) => {
  // Always allow errors and warnings
  if (info.level === "error" || info.level === "warn") {
    return info;
  }

  // Allow info logs ONLY if they have the { console: true } tag
  if (info.metadata && (info.metadata as any).console) {
    return info;
  }

  // Otherwise, silence it (drop from console transport)
  return false;
});

const logger = winston.createLogger({
  level: "debug", // Captures everything for files
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DDTHH:mm:ssZ" }),
    winston.format.metadata({ fillExcept: ["message", "level", "timestamp"] }),
    sanitize(),
    winston.format.json()
  ),
  transports: [
    // FILE: Error Logs (Keep everything)
    new winston.transports.File({
      filename: path.join(__dirname, "../../../logs/error.log"),
      level: "error",
    }),

    // FILE: App Flow (Keep everything)
    new winston.transports.File({
      filename: path.join(__dirname, "../../../logs/app-flow.log"),
      level: "info",
    }),

    // CONSOLE: Clean & Minimal
    new winston.transports.Console({
      level: "info",
      format: winston.format.combine(
        consoleFilter(), // <--- Applies the filter logic
        winston.format.colorize(),
        winston.format.printf((info) => {
          // Clean output: "info: Task Initiated"
          return `${info.level}: ${info.message}`;
        })
      ),
    }),
  ],
});

export default logger;
