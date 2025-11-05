// Re-using UploadStatus from uploadProcessorType for S3 upload progress
import { UploadStatus } from '../uploadProcessor/uploadProcessorType';


export interface S3File {
  key: string;
  lastModified?: string;
  size?: number; // Added size for potential display
}

export interface S3Item {
  key: string;
  type: "file" | "dir";
  lastModified?: string;
  size?: number;
}

export interface S3ApiResponse {
  files: S3File[];
  directories: string[];
  nextContinuationToken?: string;
}

export interface useS3BrowserProps {
  updateTaskLog: (task: string, log: unknown) => void;
  clearTaskLog: (task: string) => void;
}

export interface useS3UploadProps {
  updateTaskLog: (task: string, log: unknown) => void;
  clearTaskLog: (task: string) => void;
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}

export interface S3BrowserUIProps {
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

export interface S3UploadUIProps {
  loading: boolean;
  handleUploadToS3: () => Promise<void>;
  handleUploadSplitFilesToS3: () => Promise<void>;
}

export interface S3BrowserTaskProps {
  updateTaskLog: (task: string, log: any) => void;
  clearTaskLog: (task: string) => void;
}