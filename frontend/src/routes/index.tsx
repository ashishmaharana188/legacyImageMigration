import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: () => (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-black">PDF Processor</h1>
      <p className="text-black">Please select a task from the sidebar.</p>
    </div>
  ),
});
