import winston from 'winston';
import path from 'path';

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ssZ' }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../../logs/error.log'), // Adjusted path
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../../logs/app-flow.log'), // Adjusted path
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ssZ' }),
        winston.format.json(),
        winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
        winston.format.printf(info => {
          if (info.metadata && typeof info.metadata === 'object' && 'category' in info.metadata && (info.metadata as any).category === 'app-flow') {
            return JSON.stringify(info);
          }
          return '';
        })
      ),
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../../logs/api-calls.log'), // Adjusted path
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ssZ' }),
        winston.format.json(),
        winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
        winston.format.printf(info => {
          if (info.metadata && typeof info.metadata === 'object' && 'category' in info.metadata && (info.metadata as any).category === 'api-calls') {
            return JSON.stringify(info);
          }
          return '';
        })
      ),
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../../logs/task-steps.log'), // Adjusted path
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ssZ' }),
        winston.format.json(),
        winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
        winston.format.printf(info => {
          if (info.metadata && typeof info.metadata === 'object' && 'category' in info.metadata && (info.metadata as any).category === 'task-steps') {
            return JSON.stringify(info);
          }
          return '';
        })
      ),
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../../logs/responses.log'), // Adjusted path
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ssZ' }),
        winston.format.json(),
        winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
        winston.format.printf(info => {
          if (info.metadata && typeof info.metadata === 'object' && 'category' in info.metadata && (info.metadata as any).category === 'responses') {
            return JSON.stringify(info);
          }
          return '';
        })
      ),
    }),
    new winston.transports.Console({
      level: 'info', // Log info messages and above to console
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(info => {
          if (info.metadata && typeof info.metadata === 'object' && 'category' in info.metadata) {
            return ''; // Filter out categorized messages from console
          }
          return `${info.level}: ${info.message}`;
        })
      )
    }),
  ],
});

export default logger;