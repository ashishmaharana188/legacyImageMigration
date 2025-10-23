# Upload and Process Flow

This diagram illustrates the flow of the "Upload and Process" functionality in the application, detailing how frontend and backend files interact when a user uploads an Excel file and clicks the "Upload and Process" button. The flow covers file selection, API calls, Excel processing, file operations, and result display.

```mermaid
graph TD
    subgraph Frontend
        UI[uploadProcessorUI.tsx] -->|onChange: handleFileChange| Hook[uploadProcessorHook.tsx]
        UI -->|onClick: handleUpload| Hook
        Hook -->|utilHandleFileChange| Util[uploadProcessorUtil.tsx]
        Hook -->|utilHandleUpload| Util
        Util -->|_executeRequest: uploadExcelFile| Service[uploadProcessorService.tsx]
        Util -->|logUploadStart, logUploadSuccess, logUploadFailure, updateUploadStatuses| Log[uploadProcessorLog.tsx]
        Service -->|POST /upload-excel| Router[UploadProcessApp.ts]
        Service -->|receives JSON| Util
        Util -->|setUploadMessage, setLoading, setIsUploading| UI
        Hook -->|useUploadProgressSummary: excelProcessingStatus| SummaryUI[uploadProcessorSummaryUI.tsx]
        Hook -->|useBadRowsDisplay: toggleBadRowsDisplay| Summary[uploadProcessorSumamry.tsx]
        Summary -->|parseBadRowsCsv| SummaryUI
    end

    subgraph Backend
        Router -->|/upload-excel| Controller[uploadProcessorController.ts]
        Controller -->|processExcelFile: wrapperProcessExcelFile| Wrapper[uploadProcessorWrapper.ts]
        Wrapper -->|processExcelRows| Processor[uploadExcelProcessor.ts]
        Processor -->|buildDestinationFilePath| BUtil[uploadProcessorUtil.ts]
        Wrapper -->|createProcessedExcelFile| BUtil
        Controller -->|JSON response| Service
    end

    subgraph Types
        FTypes[uploadProcessorType.tsx] --> UI & Hook & Util & Service & Log & SummaryUI & Summary
        BTypes[uploadProcessorTypes.ts] --> Controller & Wrapper & Processor & BUtil
    end
```

## Key Points
- **Frontend to Backend**: Uses Axios POST requests (`uploadProcessorService.tsx`) to `/upload-excel` endpoint (`UploadProcessApp.ts`).
- **Backend to Frontend**: Returns JSON responses via Express, processed by `uploadProcessorUtil.tsx`.
- **Critical Functions**:
  - Frontend: `handleFileChange`, `handleUpload`, `_executeRequest`, `uploadExcelFile`, `logUpload*`, `updateUploadStatuses`, `parseBadRowsCsv`.
  - Backend: `processExcelFile`, `wrapperProcessExcelFile`, `processExcelRows`, `buildDestinationFilePath`, `createProcessedExcelFile`.
- **Type Safety**: `uploadProcessorType.tsx` and `uploadProcessorTypes.ts` ensure consistent data structures.