import { createFileRoute } from '@tanstack/react-router';
import SQLAndMongoTask from '../components/action/SQLAndMongoTask';

export const Route = createFileRoute('/sql-mongo')({
  component: SQLAndMongoTask,
});
