# Legacy Image Migration Local Development Application Architecture

## Overview

The Legacy Image Migration application is a full-stack web solution for processing Excel files, generating and splitting TIFF files, uploading to AWS S3, and inserting data into relational and MongoDB databases. It includes duplicate checking, S3 browsing, and real-time updates via WebSocket.

## Architecture Components

### 1. Frontend

- **Framework**: React, TypeScript, Vite
- **Location**: `frontend/src`
- **Key Components**:
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
   - Excel upload via `UploadAndScriptTask.tsx`/`UploadAndScriptUI.tsx`.
   - `fileController.ts` → `pdfProcessor.ts` → `processed.csv`.
2. **File Splitting**:
   - Triggered via `UploadAndScriptTask.tsx`.
   - `splitProcessor.ts`/`mupdf_splitter.py` → split TIFFs in `split_output/`.
3. **S3 Upload**:
   - Triggered via `S3BrowserTask.tsx`.
   - `s3Uploader.ts`/`s3Manager.ts` → AWS S3.
4. **Database Insertion**:
   - Triggered via `SQLAndMongoTask.tsx`.
   - `database.ts`: SQL inserts.
   - `mongoDatabase.ts`: MongoDB inserts.
5. **Additional Features**:
   - Duplicate checking: `SanityCheckTask.tsx`/`SanityCheckUI.tsx`.
   - S3 browsing: `S3BrowserTask.tsx`/`S3BrowserUI.tsx`.
   - Real-time updates: `WebSocketContext.tsx`/`webSocketService.ts`.

### 4. Technology Stack

- **Frontend**: React, TypeScript, Vite, WebSocket.
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
- **Extensibility**:
  - Modular components/services for new tasks.
  - Python scripts for flexible processing.
