import { createContext } from 'react';
import { S3UploadProgress } from '../types';

export interface WebSocketContextType {
  s3UploadProgress: S3UploadProgress;
  isConnected: boolean;
}

export const WebSocketContext = createContext<WebSocketContextType | null>(null);
