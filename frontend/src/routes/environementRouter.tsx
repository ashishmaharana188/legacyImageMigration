import { useEffect, useState } from "react";
import apiClient, { configPromise } from "../../services/apiClient";

type EnvironmentOption = {
  id: string;
  label: string;
};

export default function EnvironmentRoute() {
  const [currentEnv, setCurrentEnv] = useState("");
  const [available, setAvailable] = useState<EnvironmentOption[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadEnvironment();
  }, []);

  const loadEnvironment = async () => {
    try {
      await configPromise;

      const { data } = await apiClient.get("/environment");

      setCurrentEnv(data.current);
      setAvailable(data.available);
    } catch (err) {
      console.error(err);
      setMessage("Failed to load environments.");
    }
  };

  const switchEnvironment = async (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const environment = event.target.value;

    try {
      await configPromise;

      const { data } = await apiClient.post("/environment", {
        environment,
      });

      setCurrentEnv(data.current);
      setMessage(data.message);
    } catch (err: any) {
      console.error(err);
      setMessage(
        err.response?.data?.message ?? "Failed to switch environment.",
      );
    }
  };

  return (
    <div className="p-4 border border-gray-300 w-80 rounded-md bg-white shadow-sm mt-4">
      <p className="text-gray-700 font-medium mb-2 ml-2">
        Current Environment:{" "}
        <span className="font-bold">{currentEnv.toUpperCase()}</span>
      </p>
      <div className="flex items-center space-x-2">
        <label htmlFor="environment-select" className="sr-only">
          Select Environment
        </label>
        <select
          id="environment-select"
          value={currentEnv}
          onChange={handleEnvironmentChange}
          className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        >
          <option value="development">Development</option>
          <option value="uat">UAT</option>
        </select>
      </div>
      {message && <p className="mt-2 ml-2 text-sm text-gray-600">{message}</p>}
    </div>
  );
}
