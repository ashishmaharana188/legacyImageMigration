import { useState, useEffect } from "react"; // Added useEffect
import axios from "axios";

interface FileResponse {
  message?: string;
  originalFile?: string;
  processedFile?: string;
  summary?: {
    totalRows: number;
    successfulRows: number;
    errors: number;
    notFound: number;
  };
  downloadUrl?: string;
  fileUrls?: Array<{ row: number; url: string; pageCount: number }>;
  splitFiles?: string[];
}

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [response, setResponse] = useState<FileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  const [s3UploadProgress, setS3UploadProgress] = useState<string[]>([]); // Changed to string[]

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000"); // Connect to WebSocket server

    ws.onopen = () => {
      console.log("WebSocket connection opened");
      setS3UploadProgress((prev) => [...prev, "WebSocket connected."]);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log("Received WebSocket message:", message);
      if (message.type === "s3UploadStatus") {
        setS3UploadProgress((prev) => [...prev, `S3 Upload Status: ${message.message}`]);
      } else if (message.type === "progress") {
        setS3UploadProgress((prev) => [...prev, `Uploading ${message.file}: ${message.percentage}%`]);
      } else if (message.type === "complete") {
        setS3UploadProgress((prev) => [...prev, `Completed: ${message.file}`]);
      } else if (message.type === "error") {
        setS3UploadProgress((prev) => [...prev, `Error: ${message.message}`]);
      } else {
        setS3UploadProgress((prev) => [...prev, `Message: ${message.payload}`]);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
      setS3UploadProgress((prev) => [...prev, "WebSocket disconnected."]);
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setS3UploadProgress((prev) => [...prev, "WebSocket error occurred."]);
    };

    return () => {
      ws.close(); // Clean up WebSocket connection on component unmount
    };
  }, []); // Empty dependency array means this effect runs once on mount

  const handleUploadToS3 = async () => {
    try {
      setS3UploadProgress((prev) => [...prev, "Starting S3 upload..."]);
      const response = await axios.post("http://localhost:3000/upload-to-s3");
      setS3UploadProgress((prev) => [...prev, response.data.message]);
    } catch (error) {
      console.error("Error uploading to S3:", error);
      setS3UploadProgress((prev) => [...prev, `Error: ${error instanceof Error ? error.message : "Unknown error"}`]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setResponse(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file");
      return;
    }

    const formData = new FormData();
    formData.append("excel", file);

    try {
      const res = await fetch("http://localhost:3000/upload-excel", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setResponse(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setResponse(null);
    }
  };

  const handleSplitFiles = async () => {
    try {
      const res = await fetch("http://localhost:3000/split-files", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Split failed");
      }
      setResponse((prev) => ({ ...prev, splitFiles: data.splitFiles }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Split failed");
    }
  };

  const handleGenerateSql = async () => {
    try {
      const response = await axios.post("http://localhost:3000/generate-sql");
      setSqlResult(response.data);
    } catch (error) {
      console.error("Error generating SQL:", error);
    }
  };

  const handleExecuteSql = async () => {
    try {
      const response = await axios.post("http://localhost:3000/execute-sql");
      setExecuteResult(response.data);
    } catch (error) {
      console.error("Error executing SQL:", error);
    }
  };
  const handleupdateFolioAndTransaction = async () => {
    try {
      const response = await axios.post(
        "http://localhost:3000/updateFolioAndTransaction-sql"
      );
      setUpdateFolioResult(response.data);
    } catch (error) {
      console.error("Error executing folioUpdateSQL:", error);
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
      </div>
      {s3UploadProgress.length > 0 && (
        <div className="mt-4 text-white">
          <h3 className="text-lg font-semibold">S3 Upload Progress</h3>
          <div className="bg-gray-800 p-2 rounded overflow-auto max-h-48">
            {s3UploadProgress.map((msg, index) => (
              <p key={index}>{msg}</p>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-col items-center justify-center mx-auto">
        {sqlResult && (
          <div className="mt-4 text-white">
            <h3 className="text-lg font-semibold">SQL Output</h3>
            <p>SQL: {sqlResult.sql}</p>
            <h4 className="font-semibold mt-2">Logs:</h4>
            <pre className="bg-gray-800 p-2 rounded overflow-auto max-h-48">
              {JSON.stringify(sqlResult.logs, null, 2)}
            </pre>
          </div>
        )}
        {executeResult && (
          <div className="mt-4 text-white">
            <h3 className="text-lg font-semibold">Execution Result</h3>
            <p>Result: {executeResult.result}</p>
            <h4 className="font-semibold mt-2">Logs:</h4>
            <pre className="bg-gray-800 p-2 rounded overflow-auto max-h-48">
              {JSON.stringify(executeResult.logs, null, 2)}
            </pre>
          </div>
        )}
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
          {response.fileUrls && response.fileUrls.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mt-4">Referenced Files</h2>
              <ul className="list-disc ml-6">
                {response.fileUrls.map((file) => (
                  <li key={file.row}>
                    Row {file.row}: {file.pageCount} pages{" "}
                    <a
                      href={`http://localhost:3000${file.url}`}
                      className="underline text-blue-600"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-4 text-red-600">{error}</p>}
      </div>
    </div>
  );
};

export default App;