## Architecture Reference

# Best Practices for Backend-to-Frontend Communication and Logging

## Backend-to-Frontend Communication

- **RESTful APIs or GraphQL**: Use REST for simplicity or GraphQL for efficient, flexible data retrieval.
- **HTTPS**: Ensure encrypted communication to secure data in transit.
- **Authentication/Authorization**: Implement JWT, OAuth2, or API keys for secure access.
- **Consistent Response Format**: Use JSON with standardized structure (e.g., { data, error, status }).
- **HTTP Status Codes**: Return accurate codes (e.g., 200 for success, 400 for client errors, 500 for server errors).
- **Error Messages**: Provide clear, user-friendly error messages without exposing sensitive details.
- **Rate Limiting**: Enforce on backend to protect against excessive requests.
- **CORS**: Configure properly to allow secure cross-origin requests from frontend.
- **API Versioning**: Use versioning (e.g., /api/v1/) to manage changes without breaking clients.
- **WebSockets for Real-Time**: Use for dynamic updates (e.g., notifications, live data).
- **Data Optimization**: Minimize payload size with pagination, filtering, or compression.
- **Timeout Management**: Set appropriate server timeouts to avoid long-running requests.

## Logging Best Practices

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

# Legacy Image Migration Local Development Application Architecture

## Overview

The Legacy Image Migration application is a full-stack web solution for processing Excel files, generating and splitting TIFF files, uploading to AWS S3, and inserting data into relational and MongoDB databases. It includes duplicate checking, S3 browsing, and real-time updates via WebSocket.

## Architecture Components

### 1. Frontend

- **Framework**: React, TypeScript, Vite
- **Location**: `frontend/src`
- **Key Components**:
  - **Routing** (`frontend/src/routes`):
    - Manages client-side routing for navigation between views.
  - **Action Components** (`frontend/src/components/action`):
    - `DetailsDisplayTask.tsx`: Displays processed file details.
    - `ProgressTrackingTask.tsx`: Tracks processing progress.
    - `S3BrowserTask.tsx`: Handles S3 file browsing logic.
    - `SanityCheckTask.tsx`: Performs duplicate/sanity checks.
    - `SQLAndMongoTask.tsx`: Triggers database insertions.
    - `UploadAndScriptTask.tsx`: Manages file uploads and script execution.
  - **UI Components** (`frontend/src/components/ui`):
    - `DetailsDisplayUI.tsx`, `ProgressTrackingUI.tsx`, `S3BrowserUI.tsx`, `SanityCheckUI.tsx`, `SQLAndMongoUI.tsx`, `UploadAndScriptUI.tsx`: Render task UIs.
    - `Sidebar.tsx`, `SidebarItem.tsx`: Navigation UI.
    - `SummaryDisplay.tsx`: Displays processing summaries.
  - **Contexts**:
    - `WebSocketContext.tsx`: Manages WebSocket connections.
  - **Services**:
    - `webSocketService.ts`: WebSocket communication.
  - **Other**:
    - `App.tsx`, `main.tsx`: Entry points.
    - `index.css`: Styling.
    - `types`: Type definitions.
- **Functionality**:
  - Client-side routing via `src/routes`.
  - File uploads, processing triggers, S3 browsing, database insertion, duplicate checking, real-time updates.

### 2. Backend

- **Framework**: Node.js, TypeScript, Python (MuPDF)
- **Location**: `backend/`
- **Key Components**:
  - **Controllers** (`backend/controllers`):
    - `fileController.ts`: API request routing.
  - **Services** (`backend/services`):
    - `pdfProcessor.ts`: Processes Excel to `processed.csv`.
    - `splitProcessor.ts`, `mupdf_splitter.py`, `fallBackSplit.py`: Split TIFF files.
    - `s3Uploader.ts`, `s3Manager.ts`: S3 uploads and browsing.
    - `database.ts`: SQL inserts for relational DB.
    - `mongoDatabase.ts`: MongoDB inserts.
    - `webSocketService.ts`: Real-time updates.
    - `tunnel.ts`: Local development tunneling.
    - `fallback_processor.py`: Fallback file processing.
  - **Utils**:
    - `logger.ts`: Logging (`combined.log`, `error.log`).
    - `s3Config.ts`: AWS S3 configuration.
  - **Directories**:
    - `output/`: Processed TIFFs (e.g., `CLIENT_CODE_150_TRANSACTION_NUMBER_7264776.tiff`).
    - `split_output/`: Split TIFFs (e.g., `_1.tiff` to `_79.tiff`).
    - `processed/`: Stores `processed.csv`.
    - `uploads/`: Temporary upload storage.
  - **Other**:
    - `app.ts`: Server entry.
    - `s3-tool.ts`, `upload-s3.bat`: S3 utilities.

### 3. Data Flow

1. **File Upload**:
   - Excel upload via `UploadAndScriptTask.tsx`/`UploadAndScriptUI.tsx` (routed via `src/routes`).
   - `fileController.ts` → `pdfProcessor.ts` → `processed.csv`.
2. **File Splitting**:
   - Triggered via `UploadAndScriptTask.tsx` (routed via `src/routes`).
   - `splitProcessor.ts`/`mupdf_splitter.py` → split TIFFs in `split_output/`.
3. **S3 Upload**:
   - Triggered via `S3BrowserTask.tsx` (routed via `src/routes`).
   - `s3Uploader.ts`/`s3Manager.ts` → AWS S3.
4. **Database Insertion**:
   - Triggered via `SQLAndMongoTask.tsx` (routed via `src/routes`).
   - `database.ts`: SQL inserts.
   - `mongoDatabase.ts`: MongoDB inserts.
5. **Additional Features**:
   - Duplicate checking: `SanityCheckTask.tsx`/`SanityCheckUI.tsx`.
   - S3 browsing: `S3BrowserTask.tsx`/`S3BrowserUI.tsx`.
   - Real-time updates: `WebSocketContext.tsx`/`webSocketService.ts`.

### 4. Technology Stack

- **Frontend**: React, TypeScript, Vite, WebSocket, client-side routing (`src/routes`).
- **Backend**: Node.js, TypeScript, Python (MuPDF).
- **Storage**: AWS S3.
- **Databases**: Relational (e.g., PostgreSQL), MongoDB.
- **File Processing**: Excel parsing, TIFF generation/splitting.
- **Logging**: Custom logger.

### 5. System Interactions

- **Frontend ↔ Backend**: REST APIs (`fileController.ts`), WebSocket (`webSocketService.ts`).
- **Backend ↔ S3**: AWS SDK (`s3Uploader.ts`, `s3Manager.ts`).
- **Backend ↔ Databases**: SQL/MongoDB drivers.
- **Python Integration**: Node.js invokes Python scripts.

### 6. Diagram

```
[User] → [Frontend: React/Vite]
  ↓ (Routes: src/routes)
  ↓ (REST/WebSocket)
[Backend: Node.js/TypeScript]
  ├── fileController.ts → API routing
  ├── pdfProcessor.ts → processed.csv
  ├── splitProcessor.ts/mupdf_splitter.py → Split TIFFs
  ├── s3Uploader.ts/s3Manager.ts → AWS S3
  ├── database.ts → Relational DB
  ├── mongoDatabase.ts → MongoDB
  └── webSocketService.ts → Real-time updates
```

### 7. Analysis Guidelines for LLMs

- **Frontend**:
  - Analyze `src/routes` for client-side routing logic.
  - Review `action`/`ui` components for task logic/UI.
  - Check `WebSocketContext.tsx`, `webSocketService.ts` for real-time features.
- **Backend**:
  - Start with `fileController.ts` for API endpoints.
  - Analyze `pdfProcessor.ts`, `splitProcessor.ts`, `mupdf_splitter.py` for file processing.
  - Inspect `s3Uploader.ts`, `s3Manager.ts` for S3 operations.
  - Examine `database.ts`, `mongoDatabase.ts` for DB logic.
- **Optimization**:
  - Optimize TIFF splitting (`mupdf_splitter.py`).
  - Ensure WebSocket scalability (`webSocketService.ts`).
  - Enhance error handling (`logger.ts`).
  - Review routing efficiency (`src/routes`).
- **Extensibility**:
  - Modular components/services for new tasks.
  - Flexible routing structure (`src/routes`).
  - Python scripts for adaptable processing.

# Current Flow Documentation

This section details the current implementation flow of the Legacy Image Migration application, outlining component communication, API interactions, and logging practices.

## 1. Overall Application Flow

The application starts with `backend/app.ts` initializing the Express server, WebSocket server, and database connections (PostgreSQL and MongoDB, potentially via SSH tunnels). On the frontend, `frontend/src/main.tsx` sets up the TanStack Router, which renders `frontend/src/App.tsx` within `WebSocketProvider` and `TaskLogProvider` contexts. Users interact with various tasks via the `Sidebar`, triggering actions that communicate with the backend via REST APIs and receive real-time updates via WebSockets.

## 2. Frontend Component Flows

### `UploadAndScriptTask.tsx` (`/upload-script` route)

*   **Purpose**: Manages Excel file uploads, triggers file processing (PDF/TIFF generation), file splitting, and S3 uploads for both original and split files.
*   **Context Interaction**:
    *   Uses `useTaskLog` to `updateTaskLog` with messages and results from backend operations, and `clearTaskLog` before new operations.
    *   Uses `setSummaryData` and `setUploadStatuses` to update the UI with progress and summary information.
    *   Subscribes to `webSocketService` for real-time progress updates (`s3-upload-total`, `s3-upload-progress`, `splitProgressUpdate`, `splitProgressComplete`).
*   **REST API Calls**:
    *   **File Upload**: `POST /upload-excel`
        *   **Payload**: `FormData` containing the selected Excel file.
        *   **Response**: `FileResponse` containing `message`, `originalFile`, `processedFile`, `summary`, `downloadUrl`, `fileUrls`.
        *   **Logging**: Backend (`fileController.ts` -> `pdfProcessor.ts`) logs processing steps, errors, and file operations using `winston` logger.
    *   **Run Fallback**: `POST /run-fallback`
        *   **Payload**: `FormData` containing the selected Excel file.
        *   **Response**: `FileResponse` containing `message`, `originalFile`.
        *   **Logging**: Backend (`fileController.ts`) logs the execution of the Python fallback script.
    *   **File Splitting (Legacy)**: `POST /split-files`
        *   **Payload**: `{ filename: string }` (though `filename` is not directly used by backend `splitFiles` service).
        *   **Response**: `FileResponse` containing `message`, `splitSummary`, `splitFiles`.
        *   **Logging**: Backend (`fileController.ts` -> `splitProcessor.ts`) logs splitting progress, errors, and file operations.
    *   **File Splitting (MuPDF)**: `POST /split-mupdf`
        *   **Payload**: Empty object.
        *   **Response**: `FileResponse` containing `message`, `splitSummary`, `splitFiles`.
        *   **Logging**: Backend (`fileController.ts` -> `splitProcessor.ts`) logs MuPDF splitting progress, errors, and Python script execution.
    *   **S3 Upload (Original)**: `POST /upload-to-s3`
        *   **Payload**: Empty object.
        *   **Response**: `FileResponse` containing `message`, `successful`, `failed` arrays.
        *   **Logging**: Backend (`fileController.ts` -> `s3Uploader.ts`) logs directory scanning, individual file uploads, and errors.
    *   **S3 Upload (Split)**: `POST /upload-split-to-s3`
        *   **Payload**: Empty object.
        *   **Response**: `FileResponse` containing `message`, `successful`, `failed` arrays.
        *   **Logging**: Backend (`fileController.ts` -> `s3Uploader.ts`) logs directory scanning, individual file uploads, and errors for split files.
*   **WebSocket Handling**:
    *   Receives `s3-upload-total` to set the total number of files for S3 upload.
    *   Receives `s3-upload-progress` for each file successfully uploaded to S3, incrementing a counter.
    *   Receives `splitProgressUpdate` and `splitProgressComplete` for real-time updates on file splitting progress.
*   **UI Component**: Renders `UploadAndScriptUI`.

### `S3BrowserTask.tsx` (`/s3-browser` route)

*   **Purpose**: Allows users to browse, search, and delete files/folders in the configured AWS S3 bucket.
*   **Context Interaction**: Uses `useTaskLog` for `updateTaskLog` and `clearTaskLog`.
*   **REST API Calls**:
    *   **List S3 Objects**: `GET /s3-list-objects`
        *   **Query Params**: `prefix`, `continuationToken`.
        *   **Response**: `{ statusCode, directories, files, nextContinuationToken }`.
        *   **Logging**: Backend (`fileController.ts` -> `s3Manager.ts`) logs S3 API calls and errors.
    *   **Search S3 Files**: `GET /s3-search-files`
        *   **Query Params**: `prefix`, `transactionNumberPattern`, `filenamePattern`, `continuationToken`.
        *   **Response**: `{ statusCode, files, directories, nextContinuationToken }`.
        *   **Logging**: Backend (`fileController.ts` -> `s3Manager.ts`) logs search parameters and results.
    *   **Search S3 Folders**: `GET /s3-search-folders`
        *   **Query Params**: `prefix`, `pattern`, `continuationToken`.
        *   **Response**: `{ statusCode, directories, nextContinuationToken }`.
        *   **Logging**: Backend (`fileController.ts` -> `s3Manager.ts`) logs search parameters and results.
    *   **Delete S3 Objects**: `POST /s3-delete-object`
        *   **Payload**: `{ keys: string[] }`.
        *   **Response**: `{ statusCode, message, deletedKeys }`.
        *   **Logging**: Backend (`fileController.ts` -> `s3Manager.ts`) logs deletion requests and results.
*   **UI Component**: Renders `S3BrowserUI`.

### `SanityCheckTask.tsx` (`/sanity-check` route)

*   **Purpose**: Performs duplicate checks on PostgreSQL and MongoDB data.
*   **Context Interaction**: Uses `useTaskLog` for `updateTaskLog` and `clearTaskLog`.
*   **REST API Calls**:
    *   **PostgreSQL Sanity Check**: `POST /sanity-check-duplicates`
        *   **Payload**: `{ cutoffTms, dryRun, normalize, clientCode }`.
        *   **Response**: `{ statusCode, result, dryRun, cutoffTms, deletedCount, rows, imperfectDuplicates, totalDuplicatesFound, logs }`.
        *   **Logging**: Backend (`fileController.ts` -> `database.ts`) logs dry-run results, deletion actions, and identified imperfect duplicates.
    *   **MongoDB Sanity Check**: `POST /sanity-check-duplicate-mongo`
        *   **Payload**: `{ dryRun, cutoffTms }`.
        *   **Response**: `{ statusCode, result, dryRun, duplicates, totalDuplicateGroups, totalDuplicateDocuments, logs }`.
        *   **Logging**: Backend (`fileController.ts` -> `mongoDatabase.ts`) logs dry-run results, deletion actions, and identified duplicate groups.
*   **UI Component**: Renders `SanityCheckUI`.

### `SQLAndMongoTask.tsx` (`/sql-mongo` route)

*   **Purpose**: Manages SQL execution (inserts) and MongoDB data transfer/updates.
*   **Context Interaction**: Uses `useTaskLog` for `updateTaskLog` and `clearTaskLog`.
*   **REST API Calls**:
    *   **Process SQL/Mongo (Execute SQL)**: `POST /process-sql-mongo` with `action: "executeSql"`
        *   **Payload**: `{ action: "executeSql" }`.
        *   **Response**: `{ message, totalRows, successfulRows, badRows, badRowsFilePath }`.
        *   **Logging**: Backend (`fileController.ts` -> `database.ts`) logs SQL generation, execution, transaction (BEGIN/COMMIT/ROLLBACK), and bad row details.
    *   **Process SQL/Mongo (Update Folio/Transaction)**: `POST /process-sql-mongo` with `action: "updateFolioAndTransaction"`
        *   **Payload**: `{ action: "updateFolioAndTransaction", updateAll: boolean }`.
        *   **Response**: `{ message, updatedFolioRows, updatedTransactionRows, badRows, badRowsFilePath }`.
        *   **Logging**: Backend (`fileController.ts` -> `database.ts`) logs update queries, transaction management, and bad row details.
    *   **Transfer Data to Mongo**: `POST /transfer-to-mongo`
        *   **Payload**: Empty object.
        *   **Response**: `{ statusCode, message, transferredCount, documents }`.
        *   **Logging**: Backend (`fileController.ts` -> `mongoDatabase.ts`) logs PostgreSQL data fetching, MongoDB connection/disconnection, and document insertion.
    *   **Update Mongo Transactions**: `POST /update-mongo-transactions`
        *   **Payload**: Empty object.
        *   **Response**: `{ statusCode, message, updatedCount, syncedCount, updatedDocuments, syncedDocuments }`.
        *   **Logging**: Backend (`fileController.ts` -> `mongoDatabase.ts`) logs PostgreSQL data fetching, MongoDB document updates, and sync operations.
*   **UI Component**: Renders `SQLAndMongoUI`.

## 3. Backend Service Flows

### `backend/app.ts`

*   **Purpose**: Entry point for the backend application. Initializes the Express server, middleware (CORS, JSON parsing, Multer for file uploads), and routes. Sets up SSH tunnels for PostgreSQL and MongoDB if configured. Initializes the WebSocket server and verifies S3 connection.
*   **Interactions**:
    *   **Express**: Configures routes and middleware.
    *   **Multer**: Handles multipart form data for file uploads.
    *   **`fileController.ts`**: Routes all API requests to the appropriate controller methods.
    *   **`tunnel.ts`**: `startSshTunnel`, `startMongoSshTunnel` for secure database connections.
    *   **`webSocketService.ts`**: `initWebSocket` to start the WebSocket server.
    *   **`s3Manager.ts`**: `verifyS3Connection` to check AWS S3 credentials.
    *   **`database.ts`**: `warmup` to establish initial PostgreSQL connection.
    *   **`mongoDatabase.ts`**: `connect` to establish initial MongoDB connection.
*   **Logging**: Uses `console.log` for startup messages and warnings. `process.on` handlers log unhandled rejections and uncaught exceptions.

### `backend/controllers/fileController.ts`

*   **Purpose**: Acts as the primary interface for frontend REST API requests. Delegates business logic to various backend services.
*   **Interactions**:
    *   **`pdfProcessor.ts`**: `processExcelFile` for Excel processing.
    *   **`splitProcessor.ts`**: `splitFiles`, `splitFilesWithMuPDF` for file splitting.
    *   **`s3Uploader.ts`**: `uploadDirectoryRecursive`, `uploadSplitFilesToS3` for S3 uploads.
    *   **`s3Manager.ts`**: `listFiles`, `deleteFiles`, `searchFiles`, `searchFolders` for S3 browsing.
    *   **`database.ts`**: `generateSql`, `executeSql`, `updateFolioAndTransaction`, `sanityCheckDuplicates`, `reconnect` for PostgreSQL operations.
    *   **`mongoDatabase.ts`**: `sanityCheckMongoDuplicates`, `transferDataFromPostgres`, `updateMongoTransactions` for MongoDB operations.
    *   **Python Scripts**: `runFallback` spawns a child process to execute `fallback_processor.py`.
*   **Logging**: Uses `console.error` for error logging and `console.log` for general information. All errors are caught and returned with a consistent JSON error structure.

### `backend/services/pdfProcessor.ts`

*   **Purpose**: Processes uploaded Excel files, reads source files (local or SMB), generates TIFF/PDFs, calculates page counts, and creates a `processed.csv` summary.
*   **Interactions**:
    *   **`ExcelJS`**: Reads input Excel files and writes `processed.csv`.
    *   **`fs/promises`**: File system operations (read, write, mkdir, unlink).
    *   **`sharp`**: Processes TIFF files to get metadata (page count).
    *   **`pdf-lib`**: Processes PDF files to get page count.
    *   **`webSocketService.ts`**: `broadcast`s `progressUpdate` and `progressComplete` messages to the frontend for real-time feedback during Excel processing.
*   **Logging**: Uses `winston` logger (`logs/error.log`, `logs/combined.log`) for detailed logging of file reading, processing, path building, page counting, and errors.

### `backend/services/splitProcessor.ts`

*   **Purpose**: Splits multi-page TIFF/PDF files into individual page files. Supports both native Node.js processing and Python (MuPDF/fallback) for splitting.
*   **Interactions**:
    *   **`fs/promises`**: Reads original files and writes split files.
    *   **`sharp`**: Splits TIFF files.
    *   **`pdf-lib`**: Splits PDF files.
    *   **`child_process` (`execPromise`)**: Executes Python scripts (`mupdf_splitter.py`, `fallBackSplit.py`) for splitting.
    *   **`webSocketService.ts`**: `broadcast`s `splitProgressUpdate` and `splitProgressComplete` messages to the frontend.
*   **Logging**: Uses `winston` logger for detailed logging of directory scanning, file splitting, Python script execution, and errors.

### `backend/services/s3Uploader.ts`

*   **Purpose**: Handles recursive uploads of directories and files to AWS S3.
*   **Interactions**:
    *   **`@aws-sdk/client-s3`**: Interacts with AWS S3 for file uploads.
    *   **`@aws-sdk/lib-storage` (`Upload`)**: Manages multipart uploads for efficiency.
    *   **`fs`**: Reads local files for upload.
    *   **`webSocketService.ts`**: `broadcast`s `s3-upload-total` (initial file count) and `s3-upload-progress` (for each uploaded file) messages to the frontend.
*   **Logging**: Uses `console.log` for upload status and `console.error` for S3 API errors, including specific handling for authentication token expiration.

### `backend/services/s3Manager.ts`

*   **Purpose**: Provides functionalities to list, search, and delete objects/folders in AWS S3.
*   **Interactions**:
    *   **`@aws-sdk/client-s3`**: Interacts with AWS S3 using `ListObjectsV2Command`, `DeleteObjectsCommand`, `ListBucketsCommand`.
    *   **`s3Config.ts`**: Uses `S3_BUCKET_NAME` for bucket configuration.
*   **Logging**: Uses `console.log` for S3 operations and `console.error` for S3 API errors, with specific handling for authentication token expiration.

### `backend/services/database.ts`

*   **Purpose**: Manages PostgreSQL database interactions, including SQL generation, execution, duplicate checking, and folio/transaction updates.
*   **Interactions**:
    *   **`pg` (`Pool`, `PoolClient`)**: Connects to and queries the PostgreSQL database.
    *   **`ExcelJS`**: Reads `processed.csv` to get data for SQL generation.
    *   **`fs/promises`**: Writes bad rows to log files.
*   **Logging**: Uses `winston` logger for detailed logging of database connection lifecycle, queries, transactions (BEGIN/COMMIT/ROLLBACK), errors, and bad row file writing. Includes reconnection logic for critical connection errors.

### `backend/services/mongoDatabase.ts`

*   **Purpose**: Manages MongoDB database interactions, including data transfer from PostgreSQL, duplicate checking, and transaction updates.
*   **Interactions**:
    *   **`mongoose`**: Connects to and interacts with MongoDB.
    *   **`database.ts`**: Calls `getAifDocumentDetails` and `getUpdateDetails` to fetch data from PostgreSQL.
*   **Logging**: Uses `winston` logger for MongoDB connection status, query execution, data transfer, updates, and errors. Includes collection existence checks during connection.

### `backend/services/webSocketService.ts` (Backend)

*   **Purpose**: Initializes and manages the WebSocket server, allowing the backend to broadcast real-time messages to connected frontend clients.
*   **Interactions**:
    *   **`ws` (`WebSocketServer`, `WebSocket`)**: Implements the WebSocket protocol.
    *   **`http` (`Server`)**: Attaches the WebSocket server to the existing Express HTTP server.
*   **Logging**: Uses `console.log` for connection status and `console.error` for errors.

### `backend/utils/logger.ts`

*   **Purpose**: Provides a centralized `winston` logger instance for structured JSON logging across the backend.
*   **Configuration**:
    *   **Level**: `info` (default), `error` for `error.log`, `debug` for console.
    *   **Format**: `timestamp` (ISO 8601) and `json`.
    *   **Transports**:
        *   `logs/error.log`: For messages with level `error`.
        *   `logs/combined.log`: For all messages with level `info` and above.
        *   `Console`: For `debug` level messages and above, with colorization.
*   **Usage**: All backend services and controllers are expected to use this logger for consistent and traceable logging.

## 4. API Logging Standards (Reinforced)

The application adheres to structured JSON logging for both REST API interactions and WebSocket messages.

*   **REST API Logging**:
    *   **Backend**: `fileController.ts` and individual services (`pdfProcessor.ts`, `database.ts`, etc.) log entry, exit, and key operational steps. Errors are logged with stack traces and contextual details (e.g., input parameters, SQL queries).
    *   **Format**: `timestamp`, `level`, `function`, `context` (e.g., `userId`, `endpoint`, `query variables`), `message`, `error` (if applicable).
    *   **Example (Backend `logger.ts` output)**:
        ```json
        {
          "timestamp": "2025-10-02T10:00:00Z",
          "level": "INFO",
          "function": "processExcelFile",
          "context": { "originalFile": "example.xlsx" },
          "message": "Processing file: example.xlsx"
        }
        {
          "timestamp": "2025-10-02T10:01:00Z",
          "level": "ERROR",
          "function": "executeSql",
          "context": { "transactionId": "abc123" },
          "message": "SQL execution failed",
          "error": "ECONNREFUSED: Connection refused..."
        }
        ```
*   **WebSocket Logging**:
    *   **Backend**: `webSocketService.ts` (backend) logs connection status. Individual services (e.g., `pdfProcessor.ts`, `s3Uploader.ts`, `splitProcessor.ts`) `broadcast` JSON messages for real-time progress updates.
    *   **Frontend**: `WebSocketContext.tsx` and `frontend/src/services/webSocketService.ts` log connection status and parse incoming JSON messages.
    *   **Message Structure (Example from Backend Broadcast)**:
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
    *   **Frontend Handling**: These messages are consumed by `WebSocketContext.tsx` to update `uploadStatuses` and `taskLogs`, which are then displayed in `SummaryDisplay.tsx` and `DetailsDisplayUI.tsx`. Throttling is applied in `UploadAndScriptTask.tsx` to manage frequent updates.