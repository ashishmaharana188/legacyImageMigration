
import React from 'react';

interface S3File {
  key: string;
  lastModified?: string;
}

interface S3BrowserUIProps {
  s3Files: S3File[];
  s3Directories: string[];
  currentPrefix: string;
  nextContinuationToken: string | undefined;
  isFilterMode: boolean;
  transactionNumberPattern: string;
  filenamePattern: string;
  searchResults: S3File[];
  clientPage: number;
  searchPage: number;
  itemsPerPage: number;
  totalPages: number;
  totalSearchPages: number;
  paginatedItems: any[];
  paginatedSearchResults: S3File[];
  setIsFilterMode: React.Dispatch<React.SetStateAction<boolean>>;
  setTransactionNumberPattern: React.Dispatch<React.SetStateAction<string>>;
  setFilenamePattern: React.Dispatch<React.SetStateAction<string>>;
  setClientPage: React.Dispatch<React.SetStateAction<number>>;
  setSearchPage: React.Dispatch<React.SetStateAction<number>>;
  handleLoadMore: () => void;
  handleDeleteS3File: (key: string) => Promise<void>;
  handleDirectoryClick: (directoryKey: string) => void;
  handleBreadcrumbClick: (index: number) => void;
  handleSearch: () => Promise<void>;
}

const S3BrowserUI: React.FC<S3BrowserUIProps> = ({
  s3Files,
  s3Directories,
  currentPrefix,
  nextContinuationToken,
  isFilterMode,
  transactionNumberPattern,
  filenamePattern,
  searchResults,
  clientPage,
  searchPage,
  itemsPerPage,
  totalPages,
  totalSearchPages,
  paginatedItems,
  paginatedSearchResults,
  setIsFilterMode,
  setTransactionNumberPattern,
  setFilenamePattern,
  setClientPage,
  setSearchPage,
  handleLoadMore,
  handleDeleteS3File,
  handleDirectoryClick,
  handleBreadcrumbClick,
  handleSearch,
}) => {
  return (
    <div className="mt-8 w-full max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">S3 Browser</h2>
        <button
          onClick={() => setIsFilterMode(!isFilterMode)}
          className={`px-4 py-2 text-white rounded ${
            isFilterMode
              ? "bg-red-500 hover:bg-red-600"
              : "bg-indigo-500 hover:bg-indigo-600"
          }`}
        >
          {isFilterMode ? "Cancel Search" : "Search / Filter"}
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
              <h3 className="text-lg font-semibold">
                Search Results ({searchResults.length} found)
              </h3>
              <ul className="bg-gray-800 p-2 rounded space-y-1">
                <li className="p-1 grid grid-cols-12 gap-2 font-semibold text-gray-400">
                  <span className="col-span-7">Name</span>
                  <span className="col-span-4">Last Modified</span>
                  <span className="col-span-1"></span>
                </li>
                {paginatedSearchResults.map((file) => (
                  <li
                    key={file.key}
                    className="p-1 grid grid-cols-12 gap-2 items-center hover:bg-gray-700 rounded"
                  >
                    <span className="col-span-7 truncate" title={file.key}>
                      {file.key.split("/").pop()}
                    </span>
                    <span className="col-span-4 text-sm text-gray-400">
                      {file.lastModified
                        ? new Date(file.lastModified).toLocaleString()
                        : "N/A"}
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
                  onClick={() =>
                    setSearchPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={searchPage === 1}
                  className="px-4 py-2 bg-gray-600 text-white rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-white">
                  Page {searchPage} of {totalSearchPages}
                </span>
                <button
                  onClick={() =>
                    setSearchPage((prev) =>
                      Math.min(prev + 1, totalSearchPages)
                    )
                  }
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
            {currentPrefix
              .split("/")
              .filter(Boolean)
              .map((part, index) => (
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
                if (item.type === "dir") {
                  return (
                    <li
                      key={item.key}
                      onClick={() => handleDirectoryClick(item.key)}
                      className="p-1 grid grid-cols-12 gap-2 items-center cursor-pointer hover:bg-gray-700 rounded"
                    >
                      <span
                        className="col-span-7 flex items-center gap-2 truncate"
                        title={item.key
                          .replace(currentPrefix, "")
                          .replace("/", "")}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 flex-shrink-0"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                        </svg>
                        {item.key.replace(currentPrefix, "").replace("/", "")}
                      </span>
                      <span className="col-span-4"></span>
                      <span className="col-span-1"></span>
                    </li>
                  );
                } else {
                  const s3FileItem = item as S3File;
                  return (
                    <li
                      key={s3FileItem.key}
                      className="p-1 grid grid-cols-12 gap-2 items-center hover:bg-gray-700 rounded"
                    >
                      <span
                        className="col-span-7 flex items-center gap-2 truncate"
                        title={s3FileItem.key.replace(currentPrefix, "")}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 flex-shrink-0"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {s3FileItem.key.replace(currentPrefix, "")}
                      </span>
                      <span className="col-span-4 text-sm text-gray-400">
                        {s3FileItem.lastModified
                          ? new Date(s3FileItem.lastModified).toLocaleString()
                          : "N/A"}
                      </span>
                      <span className="col-span-1 flex justify-end">
                        <button
                          onClick={() => handleDeleteS3File(s3FileItem.key)}
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
                onClick={() => setClientPage((prev) => Math.max(prev - 1, 1))}
                disabled={clientPage === 1}
                className="px-4 py-2 bg-gray-600 text-white rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-white">
                Page {clientPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setClientPage((prev) => Math.min(prev + 1, totalPages))
                }
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
  );
};

export default S3BrowserUI;
