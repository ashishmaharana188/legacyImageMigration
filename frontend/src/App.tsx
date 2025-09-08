import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import UploadAndScriptTask from "./components/action/UploadAndScriptTask";
import SQLAndMongoTask from "./components/action/SQLAndMongoTask";
import S3BrowserTask from "./components/action/S3BrowserTask";
import SanityCheckTask from "./components/action/SanityCheckTask";
import Sidebar from "./components/ui/Sidebar";
import SummaryDisplay from "./components/ui/SummaryDisplay";

interface FileResponse {
  statusCode?: number;
  message?: string;
  originalFile?: string;
  processedFile?: string;
  nextContinuationToken?: string;
  summary?: {
    totalRows: number;
    successfulRows: number;
    errors: number;
    notFound: number;
    successfulInserts: number; // Added from pdfProcessor.ts
    unsuccessfulCount: number; // Added from pdfProcessor.ts (bad rows)
    totalPageCount: number; // Added from pdfProcessor.ts
    totalSplitImages: number; // Added from pdfProcessor.ts
  };
  splitSummary?: {
    totalOriginalFilesProcessed: number;
    totalExpectedSplits: number; // Re-added: Internal count of expected splits
    totalSplitFilesGenerated: number;
    splitErrors: number;
    totalExpectedPagesFromCsv: number; // Added from splitProcessor.ts
  };
  downloadUrl?: string;
  fileUrls?: Array<{ row: number; url: string; pageCount: number }>;
  splitFiles?: string[];
  error?: string;
  directories?: string[];
  files?: S3File[];
}

interface S3File {
  key: string;
  lastModified?: string;
}

const App: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null); // New state for selected task

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  const handleSelectTask = (task: string) => {
    setSelectedTask(task);
    setOpen(false); // Close sidebar on task selection
  };

  const [response, setResponse] = useState<FileResponse | null>(null);
  const [logs, setLogs] = useState<{ status: string; errors: string[] }>({
    status: "",
    errors: [],
  });
  const [updateFolioResult, setUpdateFolioResult] = useState<unknown>(null);
  const [sanityCheckResult, setSanityCheckResult] = useState<unknown>(null);

  return (
    <div
      className="flex min-h-screen"
      style={{ backgroundColor: "whitesmoke" }}
    >
      <Sidebar
        open={open}
        handleDrawerOpen={handleDrawerOpen}
        handleDrawerClose={handleDrawerClose}
        onSelectTask={handleSelectTask} // Pass the new handler
      />
      <main className="flex-grow p-4">
        <h1 className="text-2xl font-bold mb-4 text-black">PDF Processor</h1>
        {!selectedTask && (
          <p className="text-black">Please select a task from the sidebar.</p>
        )}
        {selectedTask === "uploadAndScript" && <UploadAndScriptTask setResponse={setResponse} />}
        {selectedTask === "sqlAndMongo" && (
          <SQLAndMongoTask
            setResponse={setResponse}
            setLogs={setLogs}
            setUpdateFolioResult={setUpdateFolioResult}
          />
        )}
        {selectedTask === "sanityCheck" && (
          <SanityCheckTask
            setLogs={setLogs}
            setSanityCheckResult={setSanityCheckResult}
          />
        )}
        {selectedTask === "s3Browser" && <S3BrowserTask setLogs={setLogs} />}
        {(logs.status ||
          logs.errors.length > 0 ||
          response?.summary ||
          response?.splitSummary) && (
          <SummaryDisplay response={response} logs={logs} />
        )}
        <div className="flex flex-col items-center justify-center mx-auto">
          {logs.errors.length > 0 && (
            <p className="mt-4 text-red-600">
              {logs.errors[logs.errors.length - 1]}
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
