import { useContext } from "react";
import { TaskLogContext } from '../contexts/TaskLogContextDefinition';
import { TaskLogContextType } from '../types';

export const useTaskLog = (): TaskLogContextType => {
  const context = useContext(TaskLogContext);
  if (context === undefined) {
    throw new Error('useTaskLog must be used within a TaskLogProvider');
  }
  return context;
};