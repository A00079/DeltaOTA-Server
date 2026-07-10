"use client";

import { useEffect, useState } from "react";
import StatCard from "@/components/StatCard";

interface AnalyticsData {
  events: Array<{
    id: string;
    appId: string;
    event: string;
    jsVersion: number;
    bundleVersion: number;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>;
  counts: Record<string, number>;
  total: number;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      const res = await fetch("/api/analytics?limit=200");
      const json = await res.json();
      setData(json);
      setLoading(false);
    }
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-white mb-6">Analytics</h1>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-white mb-6">Analytics</h1>
        <p className="text-gray-500">Failed to load analytics</p>
      </div>
    );
  }

  const downloadCount = data.counts["download"] || 0;
  const installCount = data.counts["install_success"] || 0;
  const failureCount = data.counts["install_failure"] || 0;
  const successRate =
    installCount + failureCount > 0
      ? ((installCount / (installCount + failureCount)) * 100).toFixed(1)
      : "N/A";

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Events" value={data.total} icon="📊" />
        <StatCard title="Downloads" value={downloadCount} icon="⬇️" />
        <StatCard title="Installs" value={installCount} icon="✅" />
        <StatCard
          title="Success Rate"
          value={successRate === "N/A" ? successRate : `${successRate}%`}
          icon="📈"
        />
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Event Counts</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(data.counts).map(([event, count]) => (
            <div key={event} className="p-3 bg-gray-900 rounded-lg">
              <p className="text-xs text-gray-400 truncate">{event}</p>
              <p className="text-xl font-bold text-white">{count}</p>
            </div>
          ))}
        </div>
        {Object.keys(data.counts).length === 0 && (
          <p className="text-gray-500 text-sm">No events recorded yet</p>
        )}
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Events</h2>
        {data.events.length === 0 ? (
          <p className="text-gray-500 text-sm">No events recorded yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Event</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">App ID</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">JS Ver</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Bundle Ver</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {data.events
                  .slice()
                  .reverse()
                  .map((event) => (
                    <tr key={event.id} className="border-b border-gray-800 hover:bg-gray-900">
                      <td className="py-2 px-3 text-white">{event.event}</td>
                      <td className="py-2 px-3 text-gray-300">{event.appId}</td>
                      <td className="py-2 px-3 text-gray-300">{event.jsVersion}</td>
                      <td className="py-2 px-3 text-gray-300">{event.bundleVersion}</td>
                      <td className="py-2 px-3 text-gray-500">
                        {new Date(event.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
