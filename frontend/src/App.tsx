import { useState, useCallback, useEffect, useRef } from "react";
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
  progress?: number; // This will be the calculated percentage
  status?: string;
  isDirectory?: boolean;
  totalFiles?: number; // This will map to totalRows from backend
  processedFiles?: number; // This will map to processedRows from backend
  successfulFiles?: number; // This will map to successfulRows from backend
  errorFiles?: number; // This will map to errors from backend
  notFoundFiles?: number; // This will map to notFound from backend
  badRowsDetails?: Array<{
    rowNumber: number;
    id_fund: string;
    id_trtype: string;
    id_ihno: string;
    id_path: string;
    id_acno: string;
    page_count_status: string | number;
  }>;
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

interface S3UploadProgress {
  processed: number;
  total: number;
}

const App: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryItem[]>([]);
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);
  const [taskLogs, setTaskLogs] = useState<{ [key: string]: TaskLog[] }>({});

  // State for the high-level S3 progress
  const [s3UploadProgress, setS3UploadProgress] = useState<S3UploadProgress>({
    processed: 0,
    total: 0,
  });

  // Ref to accumulate progress updates without triggering re-renders
  const progressAccumulator = useRef<S3UploadProgress>({
    processed: 0,
    total: 0,
  });

  const reconnectAttempts = useRef(0);

  // This effect sets up an interval to batch updates from the ref to the state
  useEffect(() => {
    const interval = setInterval(() => {
      // Only update state if the accumulated value has changed
      setS3UploadProgress((prevProgress) => {
        if (
          prevProgress.processed !== progressAccumulator.current.processed ||
          prevProgress.total !== progressAccumulator.current.total
        ) {
          return { ...progressAccumulator.current };
        }
        return prevProgress;
      });
    }, 200); // Update the UI every 200ms

    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

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
        reconnectAttempts.current = 0; // Reset reconnect attempts on successful connection
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          // console.log("WebSocket message received:", message); // Too noisy for 200k files

          // --- START of S3 Progress Handling Logic ---
          if (message.type === "s3-upload-total") {
            progressAccumulator.current.total = message.totalFiles;
          }

          if (message.type === "s3-upload-progress") {
            // This is the only thing that happens on each message: a cheap ref update.
            // No state change, no re-render.
            progressAccumulator.current.processed += 1;
          }
          // --- END of S3 Progress Handling Logic ---

          if (
            message.type === "progressUpdate" ||
            message.type === "progressComplete"
          ) {
            setUploadStatuses((prevStatuses) => {
              const fileName = "excel_processing"; // A fixed identifier for this task
              const existingFileIndex = prevStatuses.findIndex(
                (s) => s.fileName === fileName
              );

              const totalRows = message.totalRows || 0;
              const processedRows = message.processedRows || 0;
              const progressPercentage =
                totalRows > 0
                  ? Math.round((processedRows / totalRows) * 100)
                  : 0;

              let newStatus: UploadStatus = {
                fileName: fileName,
                progress: progressPercentage,
                status:
                  message.type === "progressComplete"
                    ? "Complete"
                    : "Processing",
                totalFiles: totalRows,
                processedFiles: processedRows,
                successfulFiles: message.successfulRows || 0,
                errorFiles: message.errors || 0,
                notFoundFiles: message.notFound || 0,
                badRowsDetails:
                  prevStatuses[existingFileIndex]?.badRowsDetails || [],
              };

              if (
                message.currentRow &&
                (message.currentRow.page_count_status === "Error" ||
                  message.currentRow.page_count_status === "Not Found" ||
                  message.currentRow.page_count_status === "Path Error" ||
                  message.currentRow.page_count_status === "Missing serverId" ||
                  message.currentRow.page_count_status ===
                    "Missing drivePath" ||
                  message.currentRow.page_count_status === "Missing pathVal" ||
                  message.currentRow.page_count_status === "Unsupported" ||
                  message.currentRow.page_count_status === "PDF Error")
              ) {
                const currentBadRows = newStatus.badRowsDetails || [];
                const isDuplicate = currentBadRows.some(
                  (detail) =>
                    detail.id_ihno === message.currentRow.id_ihno &&
                    detail.id_acno === message.currentRow.id_acno &&
                    detail.page_count_status ===
                      message.currentRow.page_count_status
                );

                if (!isDuplicate) {
                  newStatus.badRowsDetails = [
                    ...currentBadRows,
                    message.currentRow,
                  ];
                }
              }

              if (existingFileIndex > -1) {
                const updatedStatuses = [...prevStatuses];
                updatedStatuses[existingFileIndex] = {
                  ...updatedStatuses[existingFileIndex],
                  ...newStatus,
                };
                return updatedStatuses;
              } else {
                return [...prevStatuses, newStatus];
              }
            });
          } else if (
            message.type === "progress" ||
            message.type === "complete"
          ) {
            // This logic is for the detailed, per-file view which we are avoiding for the 200k scenario
            // It can remain for other smaller uploads if needed, but won't be triggered by the new message types
            setTimeout(() => {
              setUploadStatuses((prevStatuses) => {
                const { fileName, progress, status, isDirectory, totalFiles } =
                  message;
                const newStatuses = [...prevStatuses];

                // Find or create the status entry for the current file or directory
                let itemIndex = newStatuses.findIndex(
                  (s) => s.fileName === fileName
                );
                if (itemIndex === -1) {
                  newStatuses.push({
                    fileName,
                    progress,
                    status,
                    isDirectory,
                    totalFiles,
                  });
                  itemIndex = newStatuses.length - 1;
                } else {
                  newStatuses[itemIndex] = {
                    ...newStatuses[itemIndex],
                    progress,
                    status,
                    isDirectory,
                    totalFiles: totalFiles ?? newStatuses[itemIndex].totalFiles,
                  };
                }

                // If it's a file, update its parent directory's progress
                if (!isDirectory) {
                  const pathParts = fileName.split("/");
                  if (pathParts.length > 1) {
                    const parentDirName = pathParts.slice(0, -1).join("/");
                    const parentDirIndex = newStatuses.findIndex(
                      (s) => s.fileName === parentDirName
                    );

                    if (parentDirIndex !== -1) {
                      // Calculate the aggregate progress of the directory
                      const children = newStatuses.filter(
                        (s) =>
                          s.fileName.startsWith(parentDirName + "/") &&
                          !s.isDirectory
                      );
                      const totalProgress = children.reduce(
                        (acc, child) => acc + (child.progress || 0),
                        0
                      );
                      const averageProgress =
                        children.length > 0
                          ? Math.round(totalProgress / children.length)
                          : 0;
                      newStatuses[parentDirIndex].progress = averageProgress;
                    }
                  }
                }

                return newStatuses;
              });
            }, 100); // 100ms delay
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected. Attempting to reconnect...");
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttempts.current),
          30000
        ); // Max 30 seconds
        reconnectTimeout = setTimeout(() => {
          reconnectAttempts.current++;
          connectWebSocket();
        }, delay);
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
  }, []); // Empty dependency array to ensure useEffect runs only once

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

  const clearTaskLog = useCallback((task: string) => {
    setTaskLogs((prev) => ({ ...prev, [task]: [] }));
  }, []);

  // Reset progress when a new task is selected
  const handleSelectTaskAndReset = (task: string) => {
    progressAccumulator.current = { processed: 0, total: 0 };
    setS3UploadProgress({ processed: 0, total: 0 });
    setUploadStatuses([]); // Also clear the detailed statuses
    handleSelectTask(task);
  };

  return (
    <div
      className="flex min-h-screen"
      style={{ backgroundColor: "whitesmoke" }}
    >
      <Sidebar
        open={open}
        handleDrawerOpen={handleDrawerOpen}
        handleDrawerClose={handleDrawerClose}
        onSelectTask={handleSelectTaskAndReset} // Use the resetting handler
      />
      <PanelGroup direction="horizontal" className="flex-grow">
        <Panel defaultSize={67} minSize={10}>
          <div className="p-4 border-r border-gray-300 h-full overflow-y-auto">
            <SummaryDisplay
              taskLogs={taskLogs}
              uploadStatuses={uploadStatuses}
              onClearLogs={clearTaskLog}
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
                clearTaskLog={clearTaskLog}
                setSummaryData={setSummaryData}
                setUploadStatuses={setUploadStatuses}
              />
            )}
            {selectedTask === "sqlAndMongo" && (
              <SQLAndMongoTask
                updateTaskLog={updateTaskLog}
                clearTaskLog={clearTaskLog}
              />
            )}
            {selectedTask === "sanityCheck" && (
              <SanityCheckTask
                updateTaskLog={updateTaskLog}
                clearTaskLog={clearTaskLog}
              />
            )}
            {selectedTask === "s3Browser" && (
              <S3BrowserTask
                updateTaskLog={updateTaskLog}
                clearTaskLog={clearTaskLog}
              />
            )}

            <div className="flex flex-col items-center justify-center mx-auto">
              {taskLogs.sqlAndMongo &&
                taskLogs.sqlAndMongo.length > 0 &&
                (() => {
                  const lastLog =
                    taskLogs.sqlAndMongo[taskLogs.sqlAndMongo.length - 1];
                  if (
                    typeof lastLog !== "string" &&
                    "message" in lastLog &&
                    lastLog.message.includes("failed")
                  ) {
                    return (
                      <p className="mt-4 text-red-600">{lastLog.message}</p>
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
