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
    <div className="mt-8 w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-black">S3 Browser</h2>
        <div className="flex gap-2">
          <button onClick={handleReload} className="btn">
            Reload S3
          </button>
          <button onClick={() => setIsFilterMode(!isFilterMode)} className="btn">
            {isFilterMode ? "Cancel Search" : "Search / Filter"}
          </button>
        </div>
      </div>

      {isFilterMode ? (
        <div>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for folders..."
              className="flex-grow px-4 py-2 border rounded"
            />
            {isSearching && <div>Searching...</div>}
          </div>
          {searchResults.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold">
                Search Results ({searchResults.length} found)
              </h3>
              <ul>
                {paginatedSearchResults.map((item) => (
                  <li key={item.key} onClick={() => handleDirectoryClick(item.key)} className="p-1 cursor-pointer hover:bg-gray-200 rounded">
                    {item.key.replace(currentPrefix, "").replace("/", "")}
                  </li>
                ))}
              </ul>
              <div className="flex justify-between items-center mt-4">
                <button onClick={() => setSearchPage((prev) => Math.max(prev - 1, 1))} disabled={searchPage === 1} className="btn">
                  Previous
                </button>
                <span>
                  Page {searchPage} of {totalSearchPages}
                </span>
                <button onClick={() => setSearchPage((prev) => Math.min(prev + 1, totalSearchPages))} disabled={searchPage === totalSearchPages} className="btn">
                  Next
                </button>
              </div>
              {searchContinuationToken && (
                <div className="flex justify-center mt-4">
                  <button onClick={handleLoadMoreSearch} className="btn">
                    Load More
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-t-md">
            {currentPrefix.split("/").filter(Boolean).map((part, index) => (
              <div key={index} className="flex items-center gap-2">
                <span onClick={() => handleBreadcrumbClick(index)} className="cursor-pointer hover:underline">
                  {part}
                </span>
                <span>/</span>
              </div>
            ))}
          </div>
          <div className="bg-white p-2 rounded-b-md min-h-[400px]">
            <div className="text-lg mb-2 px-1">
              {s3Directories.length} directories, {s3Files.length} files
            </div>
            <ul>
              {paginatedItems.map((item) => {
                if (item.type === "dir") {
                  return (
                    <li key={item.key} onClick={() => handleDirectoryClick(item.key)} className="p-1 cursor-pointer hover:bg-gray-200 rounded">
                      {item.key.replace(currentPrefix, "").replace("/", "")}
                    </li>
                  );
                } else {
                  const s3FileItem = item as S3File;
                  return (
                    <li key={s3FileItem.key} className="p-1 flex justify-between items-center hover:bg-gray-200 rounded">
                      <span>{s3FileItem.key.replace(currentPrefix, "")}</span>
                      <button onClick={() => handleDeleteS3File(s3FileItem.key)} className="btn-danger">
                        Delete
                      </button>
                    </li>
                  );
                }
              })}
            </ul>

            {nextContinuationToken && (
              <div className="flex justify-center mt-4">
                <button onClick={handleLoadMore} className="btn">
                  Load More from S3
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mt-4">
        <button onClick={() => setClientPage((prev) => Math.max(prev - 1, 1))} disabled={clientPage === 1} className="btn">
          Previous
        </button>
        <span>
          Page {clientPage} of {totalPages}
        </span>
        <button onClick={() => setClientPage((prev) => Math.min(prev + 1, totalPages))} disabled={clientPage === totalPages} className="btn">
          Next
        </button>
      </div>
    </div>
  );
};

export default S3BrowserUI;
