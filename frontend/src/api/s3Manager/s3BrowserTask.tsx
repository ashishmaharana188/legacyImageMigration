import React from "react";
import S3BrowserUI from "./s3BrowserUI";
import {
  useS3BrowserHook,
  useS3UploadHook,
} from "../../api/s3Manager/s3ManagerHook";
import { UploadStatus, LogEntry } from "../../types";

interface S3BrowserTaskProps {
  updateTaskLog: (task: string, log: LogEntry) => void;
  clearTaskLog: (task: string) => void;
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}

const S3BrowserTask: React.FC<S3BrowserTaskProps> = ({
  updateTaskLog,
  clearTaskLog,
  setUploadStatuses,
}) => {
  // 1. Use the Browser Hook for listing/searching/deleting
  const {
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
  } = useS3BrowserHook({ updateTaskLog, clearTaskLog });

  // 2. Use the Upload Hook for uploading logic (Originals/Splits)
  const {
    originalLoading,
    splitLoading,
    handleUploadToS3,
    handleUploadSplitFilesToS3,
  } = useS3UploadHook({
    updateTaskLog,
    clearTaskLog,
    setUploadStatuses,
  });

  return (
    <S3BrowserUI
      items={items}
      currentPrefix={currentPrefix}
      isLoading={isLoading}
      isSearching={isSearching}
      searchResults={searchResults}
      isFilterMode={isFilterMode}
      searchTerm={searchTerm}
      hasNextPage={hasNextPage}
      hasNextSearchPage={hasNextSearchPage}
      setIsFilterMode={setIsFilterMode}
      setSearchTerm={setSearchTerm}
      handleLoadMore={handleLoadMore}
      handleLoadMoreSearch={handleLoadMoreSearch}
      handleDeleteS3File={handleDeleteS3File}
      handleDirectoryClick={handleDirectoryClick}
      handleBreadcrumbClick={handleBreadcrumbClick}
      handleReload={handleReload}
      // Pass upload handlers from the hook
      handleUploadToS3={handleUploadToS3}
      handleUploadSplitFilesToS3={handleUploadSplitFilesToS3}
      originalLoading={originalLoading}
      splitLoading={splitLoading}
    />
  );
};

export default S3BrowserTask;
