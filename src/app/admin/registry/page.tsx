"use client";

import { useEffect, useState, FormEvent } from "react";

interface RegistryApp {
  appId: string;
  platform: string;
  appName: string;
  createdAt: string;
}

export default function RegistryPage() {
  const [apps, setApps] = useState<RegistryApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [appId, setAppId] = useState("");
  const [platform, setPlatform] = useState("android");
  const [appName, setAppName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function fetchApps() {
    const res = await fetch("/api/registry");
    const data = await res.json();
    setApps(data.apps || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchApps();
  }, []);

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/registry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId, platform, appName }),
    });

    if (res.ok) {
      setSuccess(`App registered: ${appId} (${platform})`);
      setAppId("");
      setAppName("");
      fetchApps();
    } else {
      const data = await res.json();
      setError(data.error || "Registration failed");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">App Registry</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Registered Apps</h2>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : apps.length === 0 ? (
            <p className="text-gray-500">No apps registered</p>
          ) : (
            <div className="space-y-3">
              {apps.map((app) => (
                <div
                  key={`${app.appId}-${app.platform}`}
                  className="p-4 bg-gray-900 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{app.appName}</p>
                      <p className="text-xs text-gray-400 font-mono">{app.appId}</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                      {app.platform}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Registered: {new Date(app.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Register New App</h2>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                App ID
              </label>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                required
                placeholder="my-app-android"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-gray-600 placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-gray-600"
              >
                <option value="android">Android</option>
                <option value="ios">iOS</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                App Name
              </label>
              <input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                required
                placeholder="My App"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-gray-600 placeholder-gray-500"
              />
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-3">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-900/50 border border-green-700 rounded-lg p-3">
                <p className="text-green-300 text-sm">{success}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors"
            >
              Register App
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
