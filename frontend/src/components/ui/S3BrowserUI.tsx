import React from "react";

interface S3Item {
  key: string;
  type: "file" | "dir";
  lastModified?: string;
}

interface S3BrowserUIProps {
  items: S3Item[];
  currentPrefix: string;
  isLoading: boolean;
  isSearching: boolean;
  searchResults: S3Item[];
  isFilterMode: boolean;
  searchTerm: string;
  hasNextPage?: boolean;
  hasNextSearchPage?: boolean;
  setIsFilterMode: React.Dispatch<React.SetStateAction<boolean>>;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  handleLoadMore: () => void;
  handleLoadMoreSearch: () => void;
  handleDeleteS3File: (key: string) => Promise<void>;
  handleDirectoryClick: (directoryKey: string) => void;
  handleBreadcrumbClick: (index: number) => void;
  handleReload: () => void;
}

const S3BrowserUI: React.FC<S3BrowserUIProps> = ({
  items,
  currentPrefix,
  isLoading,
  isSearching,
  searchResults,
  isFilterMode,
  searchTerm,
  hasNextPage,
  hasNextSearchPage,
  setIsFilterMode,
  setSearchTerm,
  handleLoadMore,
  handleLoadMoreSearch,
  handleDeleteS3File,
  handleDirectoryClick,
  handleBreadcrumbClick,
  handleReload,
}) => {
  return (
    <div className="mt-8 w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-black">S3 Browser</h2>
        <div className="flex gap-2">
          <button onClick={handleReload} className="btn" disabled={isLoading}>
            {isLoading ? "Loading..." : "Reload"}
          </button>
          <button
            onClick={() => setIsFilterMode(!isFilterMode)}
            className="btn"
          >
            {isFilterMode ? "Cancel Search" : "Search"}
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
                {searchResults.map((item) => (
                  <li
                    key={item.key}
                    onClick={() => handleDirectoryClick(item.key)}
                    className="p-1 cursor-pointer hover:bg-gray-200 rounded"
                  >
                    {item.key.replace(currentPrefix, "").replace("/", "")}
                  </li>
                ))}
              </ul>
              {hasNextSearchPage && (
                <div className="flex justify-center mt-4">
                  <button onClick={handleLoadMoreSearch} className="btn">
                    Load More Results
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
          <div className="bg-white p-2 rounded-b-md min-h-[400px]">
            {isLoading && items.length === 0 ? (
              <div>Loading...</div>
            ) : (
              <>
                <div className="text-lg mb-2 px-1">
                  Displaying {items.length} items
                </div>
                <ul>
                  {items.map((item) => {
                    if (item.type === "dir") {
                      return (
                        <li
                          key={item.key}
                          onClick={() => handleDirectoryClick(item.key)}
                          className="p-1 cursor-pointer hover:bg-gray-200 rounded"
                        >
                          {item.key.replace(currentPrefix, "").replace("/", "")}
                        </li>
                      );
                    } else {
                      return (
                        <li
                          key={item.key}
                          className="p-1 flex justify-between items-center hover:bg-gray-200 rounded"
                        >
                          <span>{item.key.replace(currentPrefix, "")}</span>
                          <button
                            onClick={() => handleDeleteS3File(item.key)}
                            className="btn-danger"
                          >
                            Delete
                          </button>
                        </li>
                      );
                    }
                  })}
                </ul>
              </>
            )}

            {hasNextPage && (
              <div className="flex justify-center mt-4">
                <button onClick={handleLoadMore} className="btn" disabled={isLoading}>
                  {isLoading ? 'Loading...' : 'Load More'}
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
