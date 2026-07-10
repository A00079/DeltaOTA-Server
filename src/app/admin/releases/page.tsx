"use client";

import { useEffect, useState } from "react";
import ReleaseBadge from "@/components/ReleaseBadge";
import { Release, ReleaseState } from "@/lib/types";

export default function ReleasesPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAppId, setFilterAppId] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterJsVersion, setFilterJsVersion] = useState("");

  async function fetchReleases() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterAppId) params.set("appId", filterAppId);
    if (filterState) params.set("releaseState", filterState);
    if (filterJsVersion) params.set("jsVersion", filterJsVersion);

    const res = await fetch(`/api/releases?${params.toString()}`);
    const data = await res.json();
    setReleases(data.releases || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchReleases();
  }, [filterAppId, filterState, filterJsVersion]);

  async function updateRelease(
    release: Release,
    updates: { releaseState?: ReleaseState; rollout?: number }
  ) {
    const res = await fetch("/api/releases/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: release.appId,
        jsVersion: release.jsVersion,
        bundleVersion: release.bundleVersion,
        ...updates,
      }),
    });

    if (res.ok) {
      fetchReleases();
    } else {
      const data = await res.json();
      alert(data.error || "Update failed");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Releases</h1>

      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Filter by App ID"
          value={filterAppId}
          onChange={(e) => setFilterAppId(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-600"
        />
        <select
          value={filterState}
          onChange={(e) => setFilterState(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-gray-600"
        >
          <option value="">All States</option>
          <option value="0">Created</option>
          <option value="10">Staging</option>
          <option value="20">Live</option>
          <option value="25">Halted</option>
          <option value="30">Disabled</option>
          <option value="40">Deleted</option>
        </select>
        <input
          type="number"
          placeholder="JS Version"
          value={filterJsVersion}
          onChange={(e) => setFilterJsVersion(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 w-32"
        />
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : releases.length === 0 ? (
        <p className="text-gray-500">No releases found</p>
      ) : (
        <div className="space-y-4">
          {releases.map((release) => (
            <div
              key={`${release.appId}-${release.jsVersion}-${release.bundleVersion}`}
              className="bg-gray-800 border border-gray-700 rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-white">
                    {release.appId}
                  </h3>
                  <ReleaseBadge state={release.releaseState} />
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(release.updatedAt).toLocaleString()}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                <div>
                  <p className="text-gray-500">JS Version</p>
                  <p className="text-white font-mono">{release.jsVersion}</p>
                </div>
                <div>
                  <p className="text-gray-500">Bundle Version</p>
                  <p className="text-white font-mono">{release.bundleVersion}</p>
                </div>
                <div>
                  <p className="text-gray-500">Platform</p>
                  <p className="text-white">{release.platform}</p>
                </div>
                <div>
                  <p className="text-gray-500">Hash</p>
                  <p className="text-white font-mono text-xs truncate">{release.hash}</p>
                </div>
              </div>

              {release.description && (
                <p className="text-sm text-gray-400 mb-4">{release.description}</p>
              )}

              <div className="flex items-center gap-4 mb-4">
                <label className="text-sm text-gray-400">Rollout: {release.rollout}%</label>
                <input
                  type="range"
                  min={release.rollout}
                  max={100}
                  value={release.rollout}
                  onChange={(e) => {
                    const newRollout = parseInt(e.target.value, 10);
                    if (newRollout > release.rollout) {
                      updateRelease(release, { rollout: newRollout });
                    }
                  }}
                  className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  disabled={release.releaseState !== ReleaseState.LIVE}
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                {release.releaseState === ReleaseState.CREATED && (
                  <button
                    onClick={() => updateRelease(release, { releaseState: ReleaseState.STAGING })}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-medium transition-colors"
                  >
                    Promote to Staging
                  </button>
                )}
                {release.releaseState === ReleaseState.STAGING && (
                  <button
                    onClick={() => updateRelease(release, { releaseState: ReleaseState.LIVE })}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-medium transition-colors"
                  >
                    Go Live
                  </button>
                )}
                {release.releaseState === ReleaseState.LIVE && (
                  <button
                    onClick={() => updateRelease(release, { releaseState: ReleaseState.HALTED })}
                    className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded-lg font-medium transition-colors"
                  >
                    Halt
                  </button>
                )}
                {release.releaseState === ReleaseState.HALTED && (
                  <button
                    onClick={() => updateRelease(release, { releaseState: ReleaseState.LIVE })}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-medium transition-colors"
                  >
                    Resume
                  </button>
                )}
                {(release.releaseState === ReleaseState.LIVE ||
                  release.releaseState === ReleaseState.HALTED ||
                  release.releaseState === ReleaseState.STAGING) && (
                  <button
                    onClick={() => updateRelease(release, { releaseState: ReleaseState.DISABLED })}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg font-medium transition-colors"
                  >
                    Disable
                  </button>
                )}
                {release.releaseState !== ReleaseState.DELETED && (
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this release?")) {
                        updateRelease(release, { releaseState: ReleaseState.DELETED });
                      }
                    }}
                    className="px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-200 text-xs rounded-lg font-medium transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
