import { useState } from "react";
import axios from "axios";

interface FileResponse {
  statusCode?: number;
  message?: string;
  originalFile?: string;
  processedFile?: string;
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
}

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [response, setResponse] = useState<FileResponse | null>(null);
  const [s3Prefix, setS3Prefix] = useState<string>("");
  const [s3Files, setS3Files] = useState<string[]>([]);
  const [sqlResult, setSqlResult] = useState<{
    sql: string;
    logs: { row: number; status: string; message: string; sql?: string }[];
  } | null>(null);
  const [executeResult, setExecuteResult] = useState<{
    result: string;
    logs: { row: number; status: string; message: string; sql?: string }[];
  } | null>(null);
  const [updateFolioResult, setUpdateFolioResult] = useState<{
    result: string;
    logs: { row: number; status: string; message: string; sql?: string };
  } | null>(null);
  const [sanityCheckResult, setSanityCheckResult] = useState<any | null>(null);
  const [logs, setLogs] = useState<{ status: string; errors: string[] }>({
    status: "",
    errors: [],
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setResponse(null);
      setLogs({ status: "", errors: [] });
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setLogs((prev) => ({
        ...prev,
        errors: [...prev.errors, "Please select a file"],
      }));
      return;
    }

    const formData = new FormData();
    formData.append("excel", file);

    try {
      setLogs({ status: "Uploading...", errors: [] });
      const res = await fetch("http://localhost:3000/upload-excel", {
        method: "POST",
        body: formData,
      });

      const data: FileResponse = await res.json();
      if (data.statusCode !== 200) {
        throw new Error(data.error || "Upload failed");
      }

      setResponse(data);
      setLogs((prev) => ({ ...prev, status: "Upload successful." }));
    } catch (err) {
      setLogs((prev) => ({
        ...prev,
        status: "failed to run",
        errors: [
          ...prev.errors,
          err instanceof Error ? err.message : "Unknown error",
        ],
      }));
      setResponse(null);
    }
  };

  const handleSplitFiles = async () => {
    try {
      setLogs((prev) => ({ ...prev, status: "Splitting files..." }));
      const res = await fetch("http://localhost:3000/split-files", {
        method: "POST",
      });
      const data: FileResponse = await res.json();
      if (data.statusCode !== 200) {
        throw new Error(data.error || "Split failed");
      }
      setResponse((prev) => ({
        ...prev,
        splitFiles: data.splitFiles,
        splitSummary: data.splitSummary,
      }));
      setLogs((prev) => ({ ...prev, status: "Split successful." }));
    } catch (err) {
      setLogs((prev) => ({
        ...prev,
        status: "failed to run",
        errors: [
          ...prev.errors,
          err instanceof Error ? err.message : "Unknown error",
        ],
      }));
    }
  };

  const handleUploadSplitFilesToS3 = async () => {
    try {
      setLogs({ status: "Uploading split files to S3...", errors: [] });
      const response = await axios.post(
        "http://localhost:3000/upload-split-files-to-s3"
      );
      if (response.data.statusCode !== 200) {
        throw new Error(response.data.error || "Upload failed");
      }
      setLogs((prev) => ({ ...prev, status: response.data.message }));
    } catch (err) {
      setLogs((prev) => ({
        ...prev,
        status: "failed to run",
        errors: [
          ...prev.errors,
          err instanceof Error ? err.message : "Unknown error",
        ],
      }));
    }
  };

  const handleGenerateSql = async () => {
    try {
      setLogs((prev) => ({ ...prev, status: "Generating SQL..." }));
      const response = await axios.post("http://localhost:3000/generate-sql");
      if (response.data.statusCode !== 200) {
        throw new Error(response.data.error || "SQL generation failed");
      }
      setSqlResult(response.data);
      setLogs((prev) => ({ ...prev, status: "SQL generation successful." }));
    } catch (error) {
      setLogs((prev) => ({
        ...prev,
        status: "failed to run",
        errors: [
          ...prev.errors,
          error instanceof Error ? error.message : "Unknown error",
        ],
      }));
    }
  };

  const handleExecuteSql = async () => {
    try {
      setLogs((prev) => ({ ...prev, status: "Executing SQL..." }));
      const response = await axios.post("http://localhost:3000/execute-sql");
      if (response.data.statusCode !== 200) {
        throw new Error(response.data.error || "SQL execution failed");
      }
      setExecuteResult(response.data);
      setLogs((prev) => ({ ...prev, status: "SQL execution successful." }));
    } catch (error) {
      setLogs((prev) => ({
        ...prev,
        status: "failed to run",
        errors: [
          ...prev.errors,
          error instanceof Error ? error.message : "Unknown error",
        ],
      }));
    }
  };

  const handleupdateFolioAndTransaction = async () => {
    try {
      setLogs((prev) => ({
        ...prev,
        status: "Updating Folio and Transaction...",
      }));
      const response = await axios.post(
        "http://localhost:3000/updateFolioAndTransaction-sql"
      );
      if (response.data.statusCode !== 200) {
        throw new Error(
          response.data.error || "Folio and Transaction update failed"
        );
      }
      setUpdateFolioResult(response.data);
      setLogs((prev) => ({
        ...prev,
        status: "Folio and Transaction update successful.",
      }));
    } catch (error) {
      setLogs((prev) => ({
        ...prev,
        status: "failed to run",
        errors: [
          ...prev.errors,
          error instanceof Error ? error.message : "Unknown error",
        ],
      }));
    }
  };

  const handleUploadToS3 = async () => {
    try {
      setLogs((prev) => ({ ...prev, status: "Starting S3 upload..." }));
      const response = await axios.post("http://localhost:3000/upload-to-s3");
      if (response.data.statusCode !== 200) {
        throw new Error(response.data.error || "S3 upload failed");
      }
      setLogs((prev) => ({ ...prev, status: response.data.message }));
    } catch (error) {
      setLogs((prev) => ({
        ...prev,
        status: "failed to run",
        errors: [
          ...prev.errors,
          error instanceof Error ? error.message : "Unknown error",
        ],
      }));
    }
  };

  const handleSanityCheck = async () => {
    try {
      setLogs((prev) => ({ ...prev, status: "Running sanity check..." }));
      const response = await axios.post(
        "http://localhost:3000/sanity-check-duplicates",
        {
          cutoffTms: new Date().toISOString(),
          dryRun: true,
          normalize: true,
        }
      );
      if (response.data.statusCode !== 200) {
        throw new Error(response.data.error || "Sanity check failed");
      }
      setSanityCheckResult(response.data);
      setLogs((prev) => ({ ...prev, status: "Sanity check successful." }));
    } catch (error) {
      setLogs((prev) => ({
        ...prev,
        status: "failed to run",
        errors: [
          ...prev.errors,
          error instanceof Error ? error.message : "Unknown error",
        ],
      }));
    }
  };

  const handleTransferToMongo = async () => {
    try {
      setLogs((prev) => ({ ...prev, status: "Transferring to MongoDB..." }));
      const response = await axios.post(
        "http://localhost:3000/transfer-to-mongo"
      );
      if (response.data.statusCode !== 200) {
        throw new Error(response.data.error || "Transfer to MongoDB failed");
      }
      alert(response.data.message);
      setLogs((prev) => ({
        ...prev,
        status: "Transfer to MongoDB successful.",
      }));
    } catch (error) {
      setLogs((prev) => ({
        ...prev,
        status: "failed to run",
        errors: [
          ...prev.errors,
          error instanceof Error ? error.message : "Unknown error",
        ],
      }));
    }
  };

  const handleListS3Files = async () => {
    try {
      setLogs({ status: "Listing S3 files...", errors: [] });
      const response = await axios.get(
        `http://localhost:3000/api/s3/list?prefix=${s3Prefix}`
      );
      if (response.data.statusCode !== 200) {
        throw new Error(response.data.error || "Failed to list S3 files");
      }
      setS3Files(response.data.files);
      setLogs((prev) => ({ ...prev, status: "S3 files listed successfully." }));
    } catch (error) {
      setLogs((prev) => ({
        ...prev,
        status: "failed to run",
        errors: [
          ...prev.errors,
          error instanceof Error ? error.message : "Unknown error",
        ],
      }));
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-black py-8">
      <h1 className="text-2xl font-bold mb-4 text-white">
        Upload Athena Excel File
      </h1>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="mb-4 ml-25 text-white"
      />
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleUpload}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Upload
        </button>
        <button
          onClick={handleSplitFiles}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Split Files
        </button>
        <button
          onClick={handleUploadSplitFilesToS3}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          Upload Split Files to S3
        </button>
      </div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={handleGenerateSql}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Generate SQL
        </button>
        <button
          onClick={handleExecuteSql}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Execute SQL
        </button>
        <button
          onClick={handleupdateFolioAndTransaction}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Folio Update
        </button>
        <button
          onClick={handleUploadToS3}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Upload to S3
        </button>
        <button
          onClick={handleSanityCheck}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          Sanity Check Duplicates
        </button>
        <button
          onClick={handleTransferToMongo}
          className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
        >
          Transfer to Mongo
        </button>
      </div>
      <div className="mt-8 w-full max-w-2xl">
        <h2 className="text-xl font-bold mb-4 text-white">S3 File Lister</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={s3Prefix}
            onChange={(e) => setS3Prefix(e.target.value)}
            placeholder="Enter S3 prefix"
            className="flex-grow px-4 py-2 bg-gray-800 text-white rounded"
          />
          <button
            onClick={handleListS3Files}
            className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
          >
            List S3 Files
          </button>
        </div>
        {s3Files.length > 0 && (
          <div className="mt-4 text-white">
            <h3 className="text-lg font-semibold">S3 Files</h3>
            <pre className="bg-gray-800 p-2 rounded overflow-auto max-h-48">
              {s3Files.join("")}
            </pre>
          </div>
        )}
      </div>
      {(logs.status ||
        logs.errors.length > 0 ||
        response?.summary ||
        response?.splitSummary) && (
        <div className="mt-4 text-white" id="s3uploadprogress">
          <h3 className="text-lg font-semibold">Progress</h3>
          <div className="bg-gray-800 p-2 rounded overflow-auto min-h-30">
            {logs.status && <p>{logs.status}</p>}
            {logs.errors.map((err, index) => (
              <p key={index} className="text-red-500">
                Count of errors while doing something: {err}
              </p>
            ))}
            {response?.summary && (
              <div className="mt-2">
                <h4 className="font-semibold">PDF Processing Summary:</h4>
                <p>Total Rows: {response.summary.totalRows}</p>
                <p>Successful Rows: {response.summary.successfulRows}</p>
                <p>Bad Rows: {response.summary.unsuccessfulCount}</p>
              </div>
            )}
            {response?.splitSummary && (
              <div className="mt-2">
                <h4 className="font-semibold">File Splitting Summary:</h4>
                <p>
                  Total Files for Splitting:{" "}
                  {response.splitSummary.totalOriginalFilesProcessed}
                </p>
                <p>
                  Total Expected Splits (Internal):{" "}
                  {response.splitSummary.totalExpectedSplits}
                </p>
                <p>
                  Total Split Images:{" "}
                  {response.splitSummary.totalSplitFilesGenerated}
                </p>
                <p>
                  Total Expected Pages (from CSV):{" "}
                  {response.splitSummary.totalExpectedPagesFromCsv}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-col items-center justify-center mx-auto">
        {updateFolioResult && (
          <div className="mt-4 text-white">
            <h3 className="text-lg font-semibold">Folio Update Result</h3>
            <p>Result: {updateFolioResult.result}</p>
            <h4 className="font-semibold mt-2">Logs:</h4>
            <pre className="bg-gray-800 p-2 rounded overflow-auto max-h-48">
              {JSON.stringify(updateFolioResult.logs, null, 2)}
            </pre>
          </div>
        )}
        {sanityCheckResult && (
          <div className="mt-4 text-white">
            <h3 className="text-lg font-semibold">Sanity Check Result</h3>
            <pre className="bg-gray-800 p-2 rounded overflow-auto max-h-48">
              {JSON.stringify(sanityCheckResult, null, 2)}
            </pre>
          </div>
        )}
        {response?.downloadUrl && (
          <div className="mt-4">
            <div>
              <h2 className="text-lg font-semibold mt-4">Processed File</h2>
              <a
                href={`http://localhost:3000${response.downloadUrl}`}
                className="underline text-blue-600"
                target="_blank"
                rel="noopener noreferrer"
              >
                Download Processed CSV
              </a>
            </div>
          </div>
        )}
        {logs.errors.length > 0 && (
          <p className="mt-4 text-red-600">
            {logs.errors[logs.errors.length - 1]}
          </p>
        )}
      </div>
    </div>
  );
};

export default App;
