import { useState, useCallback } from "react";
import UploadAndScriptTask from "./components/action/UploadAndScriptTask";
import SQLAndMongoTask from "./components/action/SQLAndMongoTask";
import S3BrowserTask from "./components/action/S3BrowserTask";
import SanityCheckTask from "./components/action/SanityCheckTask";
import Sidebar from "./components/ui/Sidebar";
import SummaryDisplay from "./components/ui/SummaryDisplay";

interface SplitFile {
  originalPath: string;
  url: string;
  page: number;
}

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
  splitFiles?: SplitFile[];
  error?: string;
  directories?: string[];
  files?: S3File[];
  badRowsFilePath?: string | null; // Added for bad rows file download
  updatedFolioRows?: number;
  updatedTransactionRows?: number;
  badRows?: number;
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

  const [taskLogs, setTaskLogs] = useState<{[key: string]: any}>({});

  const updateTaskLog = useCallback((task: string, log: any) => {
    setTaskLogs(prev => ({...prev, [task]: log}));
  }, []);

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
      <div className="flex-grow flex">
        <div className="w-1/3 p-4 border-r border-gray-300">
          <SummaryDisplay taskLogs={taskLogs} />
        </div>
        <main className="flex-grow p-4 w-2/3">
          <h1 className="text-2xl font-bold mb-4 text-black">PDF Processor</h1>
          {!selectedTask && (
            <p className="text-black">Please select a task from the sidebar.</p>
          )}
          {selectedTask === "uploadAndScript" && <UploadAndScriptTask updateTaskLog={updateTaskLog} />}
          {selectedTask === "sqlAndMongo" && (
            <SQLAndMongoTask
              updateTaskLog={updateTaskLog}
            />
          )}
          {selectedTask === "sanityCheck" && (
            <SanityCheckTask
              updateTaskLog={updateTaskLog}
            />
          )}
          {selectedTask === "s3Browser" && <S3BrowserTask updateTaskLog={updateTaskLog} />}
          
          <div className="flex flex-col items-center justify-center mx-auto">
            {taskLogs.sqlAndMongo && taskLogs.sqlAndMongo.message && taskLogs.sqlAndMongo.message.includes("failed") && (
              <p className="mt-4 text-red-600">
                {taskLogs.sqlAndMongo.message}
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;