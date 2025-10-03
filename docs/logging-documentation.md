# Logging Documentation

This document details the logging strategy implemented in the Legacy Image Migration application for both frontend and backend components. It outlines how logs are generated, structured, and can be utilized for debugging and monitoring.

## Table of Contents
- [Logging Best Practices (Reference)](#logging-best-practices-reference)
- [Backend Logging](#backend-logging)
  - [Winston Logger Configuration](#winston-logger-configuration)
  - [Backend Logging in Action](#backend-logging-in-action)
  - [Debugging Backend Logs](#debugging-backend-logs)
- [Frontend Logging](#frontend-logging)
  - [WebSocket Communication Logging](#websocket-communication-logging)
  - [Task Log Context](#task-log-context)
  - [Debugging Frontend Logs](#debugging-frontend-logs)
- [API Logging Standards (Reinforced)](#api-logging-standards-reinforced)

## Logging Best Practices (Reference)
(As defined in `docs/architecture-design-document.md`)

- **Structured Logging**: Use JSON for logs to enable parsing and querying.
- **Log Levels**: Apply DEBUG, INFO, WARN, ERROR for appropriate granularity.
- **Contextual Data**: Include request IDs, user IDs, and timestamps for traceability.
- **Centralized Logging**: Use tools like ELK Stack, Splunk, or CloudWatch for aggregation.
- **Mask Sensitive Data**: Redact PII, tokens, or credentials in logs.
- **Error Logging**: Capture full stack traces and request details for debugging.
- **Performance Logging**: Track response times and payload sizes for optimization.
- **Log Retention**: Define policies to manage storage and comply with regulations.
- **Correlation IDs**: Use to trace requests across frontend and backend services.
- **Monitoring/Alerts**: Set up real-time alerts for critical errors or anomalies.
- **Secure Logs**: Restrict access and encrypt logs to protect sensitive information.

## Backend Logging

The backend utilizes `winston` for comprehensive, structured logging across all services and controllers. This ensures that all critical operations, data flows, and errors are recorded in a consistent and easily parsable format.

### Winston Logger Configuration

- **Location**: `backend/utils/logger.ts`
- **Purpose**: Provides a centralized `winston` logger instance.
- **Configuration Details**:
  - **Log Level**: Default `info`. `error` level for `error.log`, `debug` level for console output.
  - **Format**:
    - **File Transports**: `timestamp` (ISO 8601 format: `YYYY-MM-DDTHH:mm:ssZ`) and `json` format. This makes logs machine-readable and easy to query.
    - **Console Transport**: `colorize()` and `simple()` format for human-readable output during development.
  - **Transports (Output Destinations)**:
    - `logs/error.log`: Captures all messages with `error` level.
    - `logs/combined.log`: Captures all messages with `info` level and above.
    - `Console`: Outputs `debug` level messages and above, primarily for real-time development feedback.

### Backend Logging in Action

- **`backend/app.ts` (Server Entry Point)**:
  - Logs server startup messages, environment configurations, and database connection statuses using `logger.info`.
  - Implements `process.on('unhandledRejection')` and `process.on('uncaughtException')` to catch and log critical runtime errors using `logger.error`, ensuring application stability and providing immediate alerts for unhandled issues.

- **`backend/controllers/fileController.ts` (API Request Handling)**:
  - **Comprehensive Logging**: Now uses the `winston` logger (`logger.info`, `logger.warn`, `logger.error`) for all logging within its API endpoints.
  - **Initiating Messages**: `logger.info` messages are generated at the start of each API call, providing context about the incoming request and its parameters.
  - **Success Messages**: `logger.info` messages are generated upon successful completion of an API call, often including a summary of the operation's outcome.
  - **Failure Messages**: `logger.error` messages are generated when an error occurs, including detailed error messages, stack traces, and relevant contextual data. `logger.warn` is used for client-side errors or invalid inputs.
  - **Consistent Responses**: All errors are wrapped in a consistent JSON response structure (`statusCode`, `error`, `details`).

- **Backend Services (e.g., `pdfProcessor.ts`, `splitProcessor.ts`, `s3Uploader.ts`, `s3Manager.ts`, `database.ts`, `mongoDatabase.ts`)**:
  - These services are the primary users of the `winston` logger (imported as `logger` from `backend/utils/logger.ts`).
  - **Entry/Exit Logging**: Logs `INFO` level messages at the entry and exit points of key functions to trace execution flow.
  - **Operational Steps**: Logs `INFO` or `DEBUG` level messages for significant operational steps, such as file reading, database queries, S3 API calls, and Python script executions.
  - **Contextual Data**: Logs include relevant context, such as input parameters (`userId`, `filename`), API endpoints, query variables, and intermediate results.
  - **Error Logging**: Catches and logs `ERROR` level messages with full stack traces and detailed context whenever an operation fails (e.g., database connection errors, S3 upload failures, file processing errors). Specific error messages (e.g., "expired credentials" for S3) are often handled to provide more actionable insights.

**Example Backend Log Entry (from `logs/combined.log` or `logs/error.log`)**:
```json
{
  "timestamp": "2025-10-02T10:01:00Z",
  "level": "ERROR",
  "function": "executeSql",
  "context": { "transactionId": "abc123", "query": "INSERT INTO..." },
  "message": "SQL execution failed",
  "error": "ECONNREFUSED: Connection refused to PostgreSQL on localhost:5432"
}
{
  "timestamp": "2025-10-02T10:00:00Z",
  "level": "INFO",
  "function": "processExcelFile",
  "context": { "originalFile": "example.xlsx", "uploadPath": "/tmp/uploads/excel-123.xlsx" },
  "message": "Initiating Excel file processing"
}
```

### Debugging Backend Logs

To debug issues in the backend, developers should:
1.  **Access Log Files**: Check `logs/error.log` for critical errors and `logs/combined.log` for a full trace of application activity.
2.  **Monitor Console Output**: During development, the console provides real-time `debug` and `info` level messages.
3.  **Filter by Level**: Start by looking for `ERROR` and `WARN` messages to identify immediate problems.
4.  **Trace with Context**: Use the `timestamp`, `function`, and `context` fields to trace the flow of a specific request or operation. For example, if an API call fails, find the corresponding `ERROR` log and then trace backward using timestamps and contextual data to understand the preceding steps.
5.  **Examine Stack Traces**: For `ERROR` logs, the `error` field will often contain a stack trace, pinpointing the exact line of code where the error occurred.
6.  **Correlation**: While explicit `traceId` generation isn't globally implemented, the contextual data (e.g., `transactionId`, `filename`) can often serve as a correlation identifier for related log entries.

## Frontend Logging

The frontend's logging primarily focuses on providing real-time feedback to the user and maintaining a visible history of task execution. This is achieved through WebSocket communication and a dedicated `TaskLogContext`.

### WebSocket Communication Logging

- **Mechanism**: `frontend/src/contexts/WebSocketContext.tsx` establishes and manages a WebSocket connection to the backend. Backend services (e.g., `pdfProcessor.ts`, `s3Uploader.ts`, `splitProcessor.ts`) broadcast structured JSON messages via `backend/services/webSocketService.ts`.
- **Purpose**: To provide real-time progress updates for long-running operations (e.g., Excel processing, S3 uploads, file splitting) directly to the frontend UI.
- **Frontend Handling**: `WebSocketContext.tsx` listens for these messages, parses them, and updates the `uploadStatuses` and `taskLogs` states. A throttling mechanism is in place to prevent excessive UI re-renders during rapid updates.
- **Example WebSocket Message Structure (from Backend Broadcast)**:
  ```json
  {
    "type": "progressUpdate",
    "totalRows": 100,
    "processedRows": 10,
    "successfulRows": 8,
    "errors": 2,
    "notFound": 0,
    "currentRow": {
      "rowNumber": 11,
      "id_fund": "123",
      "id_trtype": "NEW",
      "id_ihno": "456",
      "id_path": "path/to/file.pdf",
      "id_acno": "789",
      "page_count_status": "Processing"
    }
  }
  ```

### Task Log Context

- **Location**: `frontend/src/contexts/TaskLogContext.tsx` (implicitly used by `App.tsx` and action components).
- **Purpose**: Provides a centralized way for action components to record and display task-specific messages and API responses in the `SummaryDisplay` UI component.
- **Usage**: Action components (e.g., `UploadAndScriptTask.tsx`, `S3BrowserTask.tsx`) use the `useTaskLog` hook to:
  - `updateTaskLog(task: string, log: any)`: Adds a new log entry for a specific task.
  - `clearTaskLog(task: string)`: Clears all log entries for a specific task.
- **Content**: Log entries can be simple strings or structured JSON objects representing API responses or progress updates.

### Debugging Frontend Logs

To debug issues in the frontend, developers should:
1.  **Monitor the UI's `SummaryDisplay`**: This component (`frontend/src/components/ui/SummaryDisplay.tsx`) is the primary user-facing log. It displays `taskLogs` and `uploadStatuses`, providing a real-time and historical view of operations and their outcomes.
2.  **Browser Developer Console**: Check the browser's developer console for `console.log` and `console.error` messages originating from frontend components, especially `WebSocketContext.tsx` for connection issues or message parsing errors.
3.  **Network Tab**: Use the browser's network tab to inspect REST API requests and responses, including HTTP status codes and JSON payloads. This helps verify if the frontend is sending correct requests and receiving expected responses.
4.  **React Developer Tools**: Use React Developer Tools to inspect component states (`uploadStatuses`, `taskLogs`) and props, understanding how data flows and changes over time.
5.  **WebSocket Messages**: In the browser's developer tools, the Network tab often allows inspection of WebSocket frames, showing the raw JSON messages exchanged between frontend and backend.

## API Logging Standards (Reinforced)

The application adheres to structured JSON logging for both REST API interactions and WebSocket messages, as reinforced by the code scan:

- **Backend REST API Logging**: `fileController.ts` and individual services now comprehensively use the `winston` logger for all API interactions. This includes `logger.info` for initiating and successful operations, `logger.warn` for client-side issues, and `logger.error` for failures, complete with stack traces and contextual details. This provides a comprehensive audit trail for backend operations.

- **WebSocket Logging**: Backend services broadcast JSON messages for real-time progress. The frontend's `WebSocketContext.tsx` consumes these messages, updating the `uploadStatuses` and `taskLogs` state, which are then displayed in the UI. This effectively "logs" real-time updates for immediate user feedback.

This dual-logging approach (detailed backend logs for developers, user-facing frontend logs for immediate feedback) is effective for both technical debugging and enhancing the user experience.