import { useState, useCallback, useEffect } from "react";
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

interface UploadStatus {
  fileName: string;
  progress?: number;
  status?: string;
  isDirectory?: boolean;
  totalFiles?: number;
}

interface SplitSummaryLog {
  splitSummary: {
    totalOriginalFilesProcessed: number;
    totalExpectedSplits: number;
    totalSplitFilesGenerated: number;
    splitErrors: number;
    totalExpectedPagesFromCsv: number;
  };
  splitFiles: Array<{
    id_fund: string;
    id_ihno: string;
    id_acno: string;
    page_count?: string;
    split_count?: string;
  }>;
}

interface FileUploadLog {
  originalFile: string;
  processedFile: string;
  fileUrls: Array<{
    row: number;
    pageCount: number;
  }>;
}

interface SanityCheckLog {
  dryRun: boolean;
  cutoffTms: string;
  rows: Array<{
    user_attr1: string;
    client_id: string;
    creation_date: string;
  }>;
}

interface SqlExecutionLog {
  totalRows: number;
  successfulRows: number;
  badRows: number;
  badRowsFilePath?: string;
  message: string; // "SQL executed successfully"
}

interface MongoTransferLog {
  transferredCount: number;
  documents: Array<{
    clientId: string;
    transactionNo: string;
    workDate: string;
  }>;
  message: string; // "Transferred ... documents to MongoDB successfully"
}

interface FolioTransactionUpdateLog {
  updatedFolioRows: number;
  updatedTransactionRows: number;
  badRows: number;
  badRowsFilePath?: string;
  message: string; // "Folio and Transaction updated successfully"
}

type TaskLog =
  | string
  | SplitSummaryLog
  | FileUploadLog
  | SanityCheckLog
  | SqlExecutionLog
  | MongoTransferLog
  | FolioTransactionUpdateLog;

const App: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryItem[]>([]);
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);
  const [taskLogs, setTaskLogs] = useState<{ [key: string]: TaskLog[] }>({});
  const [reconnectInterval, setReconnectInterval] = useState<number | null>(
    null
  );

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectWebSocket = () => {
      ws = new WebSocket("ws://localhost:3000");

      ws.onopen = () => {
        console.log("WebSocket connected");
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
        setReconnectInterval(null); // Reset reconnect interval on successful connection
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("WebSocket message received:", message);
          if (message.type === "progress" || message.type === "complete") {
            setUploadStatuses((prevStatuses) => {
              const existingFileIndex = prevStatuses.findIndex(
                (s) => s.fileName === message.fileName
              );
              if (existingFileIndex > -1) {
                const newStatuses = [...prevStatuses];
                newStatuses[existingFileIndex] = {
                  ...newStatuses[existingFileIndex],
                  progress: message.progress,
                  status: message.status,
                  isDirectory: message.isDirectory,
                  totalFiles:
                    message.totalFiles ??
                    newStatuses[existingFileIndex].totalFiles,
                };
                return newStatuses;
              } else {
                return [
                  ...prevStatuses,
                  {
                    fileName: message.fileName,
                    progress: message.progress,
                    status: message.status,
                    isDirectory: message.isDirectory,
                    totalFiles: message.totalFiles,
                  },
                ];
              }
            });
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected. Attempting to reconnect...");
        if (!reconnectTimeout) {
          // Only set a new timeout if one isn't already active
          reconnectTimeout = setTimeout(() => {
            setReconnectInterval((prev) => (prev ? prev * 2 : 1000)); // Exponential backoff
            connectWebSocket();
          }, reconnectInterval || 1000); // Start with 1 second, then use exponential backoff
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        ws?.close(); // Close to trigger onclose and reconnection attempt
      };
    };

    connectWebSocket(); // Initial connection

    return () => {
      ws?.close();
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [reconnectInterval]);

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

  const updateTaskLog = useCallback((task: string, log: TaskLog) => {
    setTaskLogs((prev) => {
      const existingLogs = prev[task] || [];
      return { ...prev, [task]: [...existingLogs, log] };
    });
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
        <Panel defaultSize={67} minSize={10}>
          <div className="p-4 border-r border-gray-300 h-full overflow-y-auto">
            <SummaryDisplay
              taskLogs={taskLogs}
              uploadStatuses={uploadStatuses}
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
                setUploadStatuses={setUploadStatuses}
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
                taskLogs.sqlAndMongo.length > 0 &&
                (() => {
                  const lastLog = taskLogs.sqlAndMongo[taskLogs.sqlAndMongo.length - 1];
                  if (
                    typeof lastLog !== 'string' &&
                    ('message' in lastLog) &&
                    lastLog.message.includes("failed")
                  ) {
                    return (
                      <p className="mt-4 text-red-600">
                        {lastLog.message}
                      </p>
                    );
                  }
                  return null;
                })()}
            </div>
          </main>
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default App;
