import { useState, useEffect, useMemo } from "react";
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
  directories?: string[];
  files?: S3File[];
}

interface S3File {
  key: string;
  lastModified?: string;
}

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [response, setResponse] = useState<FileResponse | null>(null);
  const [currentPrefix, setCurrentPrefix] = useState<string>("Data/");
  const [s3Directories, setS3Directories] = useState<string[]>([]);
  const [s3Files, setS3Files] = useState<S3File[]>([]);
  const [nextContinuationToken, setNextContinuationToken] = useState<string | undefined>(
    undefined
  );
  const [isFilterMode, setIsFilterMode] = useState<boolean>(false);
  const [transactionNumberPattern, setTransactionNumberPattern] = useState<string>("");
  const [filenamePattern, setFilenamePattern] = useState<string>("");
  const [searchResults, setSearchResults] = useState<S3File[]>([]);
  const [clientPage, setClientPage] = useState(1);
  const itemsPerPage = 10;
  const [searchPage, setSearchPage] = useState(1);
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

  useEffect(() => {
    setS3Directories([]);
    setS3Files([]);
    setNextContinuationToken(undefined);
    setClientPage(1); // Reset to first page on new directory
    fetchS3Objects(currentPrefix);
  }, [currentPrefix]);

  const fetchS3Objects = async (prefix: string, token?: string) => {
    try {
      setLogs({ status: "Listing S3 objects...", errors: [] });
      const response = await axios.get<FileResponse>(
        `http://localhost:3000/api/s3/list?prefix=${prefix}${token ? `&continuationToken=${token}` : ''}`
      );
      if (response.data.statusCode !== 200) {
        throw new Error(response.data.error || "Failed to list S3 objects");
      }
      setS3Directories(prev => [...prev, ...(response.data.directories || [])]);
      setS3Files(prev => [...prev, ...(response.data.files || [])]);
      setNextContinuationToken(response.data.nextContinuationToken);
      setLogs((prev) => ({ ...prev, status: "S3 objects listed successfully." }));
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

  const handleLoadMore = () => {
    if (nextContinuationToken) {
      fetchS3Objects(currentPrefix, nextContinuationToken);
    }
  };

  const handleDeleteS3File = async (key: string) => {
    if (window.confirm(`Are you sure you want to delete ${key}?`)) {
      try {
        setLogs({ status: `Deleting ${key}...`, errors: [] });
        const response = await axios.post("http://localhost:3000/api/s3/delete", { keys: [key] });
        if (response.data.statusCode !== 200) {
          throw new Error(response.data.error || "Failed to delete S3 file");
        }
        setLogs((prev) => ({ ...prev, status: `Successfully deleted ${key}.` }));

        if (isFilterMode) {
          setSearchResults(prev => prev.filter(file => file.key !== key));
        } else {
          // Refresh the browser list by re-triggering useEffect
          const prefixToReload = currentPrefix;
          setCurrentPrefix(""); // Temporarily change prefix to force reload
          setCurrentPrefix(prefixToReload);
        }
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
    }
  };

  const handleDirectoryClick = (directory: string) => {
    setCurrentPrefix(directory);
  };

  const handleBreadcrumbClick = (index: number) => {
    const prefixParts = currentPrefix.split("/").filter(Boolean);
    const newPrefix = prefixParts.slice(0, index + 1).join("/") + "/";
    setCurrentPrefix(newPrefix);
  };

  const handleSearch = async () => {
    if (!transactionNumberPattern && !filenamePattern) {
      alert("Please enter a search pattern in at least one of the fields.");
      return;
    }

    if (window.confirm("This search may take a while for large directories. Continue?")) {
      try {
        setLogs({ status: `Searching...`, errors: [] });
        setSearchPage(1); // Reset to first page for new search
        const response = await axios.get<FileResponse>(
          `http://localhost:3000/api/s3/search?prefix=${currentPrefix}&transactionPattern=${encodeURIComponent(transactionNumberPattern)}&filenamePattern=${encodeURIComponent(filenamePattern)}`
        );
        if (response.data.statusCode !== 200) {
          throw new Error(response.data.error || "Failed to search files");
        }
        setSearchResults(response.data.files || []);
        setLogs((prev) => ({ ...prev, status: "Search complete." }));
      } catch (error) {
        setLogs((prev) => ({
          ...prev,
          status: "Search failed",
          errors: [
            ...prev.errors,
            error instanceof Error ? error.message : "Unknown error",
          ],
        }));
      }
    }
  };

  const combinedItems = useMemo(() => {
    return [
      ...s3Directories.map(dir => ({ type: 'dir', key: dir })),
      ...s3Files.map(file => ({ type: 'file', ...file }))
    ];
  }, [s3Directories, s3Files]);

  const totalPages = Math.ceil(combinedItems.length / itemsPerPage);
  const paginatedItems = combinedItems.slice((clientPage - 1) * itemsPerPage, clientPage * itemsPerPage);

  const totalSearchPages = Math.ceil(searchResults.length / itemsPerPage);
  const paginatedSearchResults = searchResults.slice((searchPage - 1) * itemsPerPage, searchPage * itemsPerPage);

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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">S3 Browser</h2>
          <button
            onClick={() => setIsFilterMode(!isFilterMode)}
            className={`px-4 py-2 text-white rounded ${isFilterMode ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-500 hover:bg-indigo-600'}`}
          >
            {isFilterMode ? 'Cancel Search' : 'Search / Filter'}
          </button>
        </div>

        {isFilterMode ? (
          <div>
            {/* Search UI */}
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={transactionNumberPattern}
                onChange={(e) => setTransactionNumberPattern(e.target.value)}
                placeholder="Transaction Number contains..."
                className="flex-grow px-4 py-2 bg-gray-800 text-white rounded"
              />
              <input
                type="text"
                value={filenamePattern}
                onChange={(e) => setFilenamePattern(e.target.value)}
                placeholder="Filename contains..."
                className="flex-grow px-4 py-2 bg-gray-800 text-white rounded"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
              >
                Search
              </button>
            </div>
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-4 text-white">
                <h3 className="text-lg font-semibold">Search Results ({searchResults.length} found)</h3>
                <ul className="bg-gray-800 p-2 rounded space-y-1">
                  <li className="p-1 grid grid-cols-12 gap-2 font-semibold text-gray-400">
                    <span className="col-span-7">Name</span>
                    <span className="col-span-4">Last Modified</span>
                    <span className="col-span-1"></span>
                  </li>
                  {paginatedSearchResults.map((file) => (
                    <li key={file.key} className="p-1 grid grid-cols-12 gap-2 items-center hover:bg-gray-700 rounded">
                      <span className="col-span-7 truncate" title={file.key}>{file.key.split('/').pop()}</span>
                      <span className="col-span-4 text-sm text-gray-400">
                        {file.lastModified ? new Date(file.lastModified).toLocaleString() : 'N/A'}
                      </span>
                      <span className="col-span-1 flex justify-end">
                        <button
                          onClick={() => handleDeleteS3File(file.key)}
                          className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                        >
                          Delete
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                {/* Pagination Controls for Search */}
                <div className="flex justify-between items-center mt-4">
                  <button
                    onClick={() => setSearchPage(prev => Math.max(prev - 1, 1))}
                    disabled={searchPage === 1}
                    className="px-4 py-2 bg-gray-600 text-white rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-white">
                    Page {searchPage} of {totalSearchPages}
                  </span>
                  <button
                    onClick={() => setSearchPage(prev => Math.min(prev + 1, totalSearchPages))}
                    disabled={searchPage === totalSearchPages}
                    className="px-4 py-2 bg-gray-600 text-white rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Browser UI */}
            <div className="flex items-center gap-2 p-2 bg-gray-700 rounded-t-md">
              {currentPrefix.split("/").filter(Boolean).map((part, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span
                    onClick={() => handleBreadcrumbClick(index)}
                    className="cursor-pointer hover:underline"
                  >
                    {part}
                  </span>
                  <span>/</span>
                </div>
              ))}
            </div>
            <div className="bg-gray-800 p-2 rounded-b-md min-h-[200px]">
              <div className="text-sm text-gray-400 mb-2 px-1">
                {s3Directories.length} directories, {s3Files.length} files
              </div>
              <ul className="space-y-1">
                {/* Table Header */}
                <li className="p-1 grid grid-cols-12 gap-2 font-semibold text-gray-400">
                  <span className="col-span-7">Name</span>
                  <span className="col-span-4">Last Modified</span>
                  <span className="col-span-1"></span>
                </li>
                {paginatedItems.map((item) => {
                  if (item.type === 'dir') {
                    return (
                      <li
                        key={item.key}
                        onClick={() => handleDirectoryClick(item.key)}
                        className="p-1 grid grid-cols-12 gap-2 items-center cursor-pointer hover:bg-gray-700 rounded"
                      >
                        <span className="col-span-7 flex items-center gap-2 truncate" title={item.key.replace(currentPrefix, "").replace("/", "")}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                          </svg>
                          {item.key.replace(currentPrefix, "").replace("/", "")}
                        </span>
                        <span className="col-span-4"></span>
                        <span className="col-span-1"></span>
                      </li>
                    );
                  } else {
                    return (
                      <li key={item.key} className="p-1 grid grid-cols-12 gap-2 items-center hover:bg-gray-700 rounded">
                        <span className="col-span-7 flex items-center gap-2 truncate" title={item.key.replace(currentPrefix, "")}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                          {item.key.replace(currentPrefix, "")}
                        </span>
                        <span className="col-span-4 text-sm text-gray-400">
                          {item.lastModified ? new Date(item.lastModified).toLocaleString() : 'N/A'}
                        </span>
                        <span className="col-span-1 flex justify-end">
                          <button
                            onClick={() => handleDeleteS3File(item.key)}
                            className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                          >
                            Delete
                          </button>
                        </span>
                      </li>
                    );
                  }
                })}
              </ul>

              {/* Pagination Controls */}
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => setClientPage(prev => Math.max(prev - 1, 1))}
                  disabled={clientPage === 1}
                  className="px-4 py-2 bg-gray-600 text-white rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-white">
                  Page {clientPage} of {totalPages}
                </span>
                <button
                  onClick={() => setClientPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={clientPage === totalPages}
                  className="px-4 py-2 bg-gray-600 text-white rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>

              {nextContinuationToken && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={handleLoadMore}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Load More from S3
                  </button>
                </div>
              )}
            </div>
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
