import React from "react";

interface S3File {
  key: string;
  lastModified?: string;
}

interface S3Item extends S3File {
  type: "file" | "dir";
}

interface S3BrowserUIProps {
  s3Files: S3File[];
  s3Directories: string[];
  currentPrefix: string;
  nextContinuationToken: string | undefined;
  isFilterMode: boolean;
  searchTerm: string;
  isSearching: boolean;
  searchResults: S3Item[];
  clientPage: number;
  searchPage: number;
  totalPages: number;
  totalSearchPages: number;
  paginatedItems: S3Item[];
  paginatedSearchResults: S3Item[];
  searchContinuationToken: string | undefined;
  setIsFilterMode: React.Dispatch<React.SetStateAction<boolean>>;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  setClientPage: React.Dispatch<React.SetStateAction<number>>;
  setSearchPage: React.Dispatch<React.SetStateAction<number>>;
  handleLoadMore: () => void;
  handleDeleteS3File: (key: string) => Promise<void>;
  handleDirectoryClick: (directoryKey: string) => void;
  handleBreadcrumbClick: (index: number) => void;
  handleSearch: () => Promise<void>;
  handleLoadMoreSearch: () => void;
  handleReload: () => void;
}

const S3BrowserUI: React.FC<S3BrowserUIProps> = ({
  s3Files,
  s3Directories,
  currentPrefix,
  nextContinuationToken,
  isFilterMode,
  searchTerm,
  isSearching,
  searchResults,
  clientPage,
  searchPage,
  totalPages,
  totalSearchPages,
  paginatedItems,
  paginatedSearchResults,
  searchContinuationToken,
  setIsFilterMode,
  setSearchTerm,
  setClientPage,
  setSearchPage,
  handleLoadMore,
  handleDeleteS3File,
  handleDirectoryClick,
  handleBreadcrumbClick,
  handleSearch,
  handleLoadMoreSearch,
  handleReload,
}) => {
  return (
    <div className="mt-8 w-full max-w-6xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-black">S3 Browser</h2>
        <div className="flex gap-2">
          <button
            onClick={handleReload}
            className="px-4 py-2 bg-[#212427] brightness-150 text-white rounded hover:bg-[#212427] hover:brightness-100"
          >
            Reload S3
          </button>
          <button
            onClick={() => setIsFilterMode(!isFilterMode)}
            className={`px-4 py-2 text-white rounded ${
              isFilterMode
                ? "bg-[#212427] brightness-150 hover:bg-[#212427] hover:brightness-100"
                : "bg-[#212427] brightness-150 hover:bg-[#212427] hover:brightness-100"
            }`}
          >
            {isFilterMode ? "Cancel Search" : "Search / Filter"}
          </button>
        </div>
      </div>

      {isFilterMode ? (
        <div>
          {/* Search UI */}
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for folders..."
              className="flex-grow px-4 py-2 bg-[#212427] brightness-130 text-white rounded"
            />
            {isSearching && <div className="text-white">Searching...</div>}
          </div>
          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 text-white">
              <h3 className="text-lg font-semibold">
                Search Results ({searchResults.length} found)
              </h3>
              <ul className="bg-[#212427] brightness-130 p-2 rounded space-y-1">
                <li className="p-1 grid grid-cols-12 gap-2 font-semibold text-white">
                  <span className="col-span-7">Name</span>
                  <span className="col-span-4">Last Modified</span>
                  <span className="col-span-1"></span>
                </li>
                {paginatedSearchResults.map((item) => {
                  if (item.type === "dir") {
                    return (
                      <li
                        key={item.key}
                        onClick={() => handleDirectoryClick(item.key)}
                        className="p-1 grid grid-cols-12 gap-2 items-center cursor-pointer text-white brightness-70 hover:bg-[#212427] hover:brightness-50 rounded"
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
                    return (
                      <li
                        key={item.key}
                        className="p-1 grid grid-cols-12 gap-2 items-center hover:bg-[#212427] rounded"
                      >
                        <span
                          className="col-span-7 flex items-center gap-2 truncate"
                          title={item.key.replace(currentPrefix, "")}
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
                          {item.key.replace(currentPrefix, "")}
                        </span>
                        <span className="col-span-4 text-sm text-gray-400">
                          {item.lastModified
                            ? new Date(item.lastModified).toLocaleString()
                            : "N/A"}
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
              {/* Pagination Controls for Search */}
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => setSearchPage((prev) => Math.max(prev - 1, 1))}
                  disabled={searchPage === 1}
                  className="px-4 py-2 bg-[#212427] brightness-150 text-white rounded disabled:opacity-50"
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
                  className="px-4 py-2 bg-[#212427] brightness-150 text-white rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              {searchContinuationToken && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={handleLoadMoreSearch}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Load More
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Browser UI */}
          <div className="flex items-center gap-2 p-2 bg-[#212427] brightness-130 rounded-t-md">
            {currentPrefix
              .split("/")
              .filter(Boolean)
              .map((part, index) => (
                <div key={index} className="flex items-center gap-2 text-white">
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
          <div className="bg-[#222428] brightness-180 p-2 rounded-b-md min-h-[400px]">
            <div className="text-xl text-white brightness-60 mb-2 px-1">
              {s3Directories.length} directories, {s3Files.length} files
            </div>
            <ul className="space-y-1">
              {/* Table Header */}
              <li className="p-1 grid grid-cols-12 gap-2 font-semibold text-white">
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
                      className="p-1 grid grid-cols-12 gap-2 items-center cursor-pointer text-white brightness-60 hover:bg-[#222428] brightness-50 rounded"
                    >
                      <span
                        className="col-span-7 flex items-center gap-2 truncate text-xl"
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
                      className="p-1 grid grid-cols-12 gap-2 text-white brightness-60 items-center hover:bg-[#212427] rounded"
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

            {nextContinuationToken && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={handleLoadMore}
                  className="px-4 py-2 bg-[#212427] brightness-130 text-white rounded hover:bg-blue-600"
                >
                  Load More from S3
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex justify-between items-center mt-4">
        <button
          onClick={() => setClientPage((prev) => Math.max(prev - 1, 1))}
          disabled={clientPage === 1}
          className="px-4 py-2 bg-[#212427] brightness-130 text-white rounded disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-black text-xl">
          Page {clientPage} of {totalPages}
        </span>
        <button
          onClick={() =>
            setClientPage((prev) => Math.min(prev + 1, totalPages))
          }
          disabled={clientPage === totalPages}
          className="px-4 py-2 bg-[#212427] brightness-130 text-white rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default S3BrowserUI;
