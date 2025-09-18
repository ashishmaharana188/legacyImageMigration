import { useState, useCallback } from "react";
import UploadAndScriptTask from "./components/action/UploadAndScriptTask";
import SQLAndMongoTask from "./components/action/SQLAndMongoTask";
import S3BrowserTask from "./components/action/S3BrowserTask";
import SanityCheckTask from "./components/action/SanityCheckTask";
import Sidebar from "./components/ui/Sidebar";
import SummaryDisplay from "./components/ui/SummaryDisplay";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

interface SummaryItem {
  fileName: string;
  status: string;
}

interface SplitFile {
  [key: string]: any;
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
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryItem[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  );

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

  const [taskLogs, setTaskLogs] = useState<{ [key: string]: any }>({});

  const updateTaskLog = useCallback((task: string, log: any) => {
    setTaskLogs((prev) => ({ ...prev, [task]: log }));
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
      <PanelGroup direction="horizontal" className="flex-grow">
        <Panel defaultSize={33} minSize={10}>
          <div className="p-4 border-r border-gray-300 h-full">
            <SummaryDisplay
              taskLogs={taskLogs}
              summaryData={summaryData}
              uploadProgress={uploadProgress}
            />
          </div>
        </Panel>
        <PanelResizeHandle className="w-2 h-250 bg-gray-300 hover:bg-gray-400 cursor-ew-resize" />
        <Panel defaultSize={67} minSize={20}>
          <main className="flex-grow p-4 w-full h-full">
            <h1 className="text-2xl font-bold mb-4 text-black">
              PDF Processor
            </h1>
            {!selectedTask && (
              <p className="text-black">
                Please select a task from the sidebar.
              </p>
            )}
            {selectedTask === "uploadAndScript" && (
              <UploadAndScriptTask
                updateTaskLog={updateTaskLog}
                setSummaryData={setSummaryData}
                setUploadProgress={setUploadProgress}
              />
            )}
            {selectedTask === "sqlAndMongo" && (
              <SQLAndMongoTask updateTaskLog={updateTaskLog} />
            )}
            {selectedTask === "sanityCheck" && (
              <SanityCheckTask updateTaskLog={updateTaskLog} />
            )}
            {selectedTask === "s3Browser" && (
              <S3BrowserTask updateTaskLog={updateTaskLog} />
            )}

            <div className="flex flex-col items-center justify-center mx-auto">
              {taskLogs.sqlAndMongo &&
                taskLogs.sqlAndMongo.message &&
                taskLogs.sqlAndMongo.message.includes("failed") && (
                  <p className="mt-4 text-red-600">
                    {taskLogs.sqlAndMongo.message}
                  </p>
                )}
            </div>
          </main>
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default App;
