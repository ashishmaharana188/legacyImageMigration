import winston from "winston";
import path from "path";

// FIX: Sanitize metadata to prevent AWS credentials or tokens from leaking into log files
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
        delete metadata[key]; // Now safe to delete
      }
    });
  }
  return info;
});
const logger = winston.createLogger({
  level: "debug",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DDTHH:mm:ssZ" }),
    sanitize(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, "../../../logs/error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "../../../logs/app-flow.log"),
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DDTHH:mm:ssZ" }),
        winston.format.json(),
        winston.format.metadata({
          fillExcept: ["message", "level", "timestamp"],
        }),
        winston.format.printf((info) => {
          if (info.metadata && (info.metadata as any).category === "app-flow") {
            return JSON.stringify(info);
          }
          return "";
        })
      ),
    }),
    new winston.transports.Console({
      level: "info",
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf((info) => {
          // FIX: Explicitly exclude metadata from terminal output to prevent token leakage
          return `${info.level}: ${info.message}`;
        })
      ),
    }),
  ],
});

export default logger;
