import { createContext } from 'react';
import { TaskLogContextType } from '../types';

export const TaskLogContext = createContext<TaskLogContextType | undefined>(undefined);
