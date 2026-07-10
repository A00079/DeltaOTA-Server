"use client";

import { useEffect, useState } from "react";

interface HistoryEntry {
  id: string;
  appId: string;
  jsVersion: number;
  bundleVersion: number;
  action: string;
  previousState?: number;
  newState?: number;
  rollout?: number;
  timestamp: string;
  description?: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      const res = await fetch("/api/history?limit=100");
      const data = await res.json();
      setHistory(data.history || []);
      setLoading(false);
    }
    fetchHistory();
  }, []);

  function getActionColor(action: string): string {
    switch (action) {
      case "RELEASE_CREATED":
        return "text-blue-400";
      case "STATE_CHANGED":
        return "text-yellow-400";
      case "ROLLOUT_UPDATED":
        return "text-green-400";
      case "ROLLBACK":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">History</h1>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : history.length === 0 ? (
        <p className="text-gray-500">No history entries</p>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-900">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Action</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">App ID</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Version</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Description</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                  <td className={`py-3 px-4 font-medium ${getActionColor(entry.action)}`}>
                    {entry.action}
                  </td>
                  <td className="py-3 px-4 text-gray-300">{entry.appId}</td>
                  <td className="py-3 px-4 text-gray-300 font-mono">
                    v{entry.jsVersion}.{entry.bundleVersion}
                  </td>
                  <td className="py-3 px-4 text-gray-400 max-w-xs truncate">
                    {entry.description || "-"}
                  </td>
                  <td className="py-3 px-4 text-gray-500">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
