import { useState } from "react";
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-black">
      <h1 className="text-2xl font-bold mb-4 text-white">
        Upload Athena Excel File
      </h1>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="mb-4 ml-25 text-white"
      />
      <button
        onClick={handleUpload}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Upload
      </button>
      <button
        onClick={handleSplitFiles}
        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 mt-4"
      >
        Split Files
      </button>
      <div>
        <button
          onClick={handleGenerateSql}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 mt-4"
        >
          Generate SQL
        </button>
        <button
          onClick={handleExecuteSql}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 mt-4 ml-2"
        >
          Execute SQL
        </button>
        <button
          onClick={handleupdateFolioAndTransaction}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 mt-4 ml-2"
        >
          Folio Update
        </button>
        {sqlResult && (
          <div>
            <h3 className="text-white">SQL Output</h3>
          </div>
        )}
        {executeResult && (
          <div>
            <h3 className="text-white">Execution Result</h3>
          </div>
        )}
        {updateFolioResult && (
          <div>
            <h3 className="text-white">Execution Folio_id update</h3>
          </div>
        )}
      </div>
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
  );
};

export default App;
