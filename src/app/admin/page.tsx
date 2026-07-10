import { readJSON } from "@/lib/db";
import { Release, ReleaseState, HistoryEntry, AnalyticsEvent } from "@/lib/types";
import StatCard from "@/components/StatCard";
import ReleaseBadge from "@/components/ReleaseBadge";

export const dynamic = "force-dynamic";

export default function AdminDashboard() {
  const releases = readJSON<Release[]>("releases.json");
  const history = readJSON<HistoryEntry[]>("history.json");
  const analytics = readJSON<AnalyticsEvent[]>("analytics.json");

  const liveReleases = releases.filter((r) => r.releaseState === ReleaseState.LIVE);
  const stagingReleases = releases.filter((r) => r.releaseState === ReleaseState.STAGING);
  const recentHistory = history.slice(-5).reverse();

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Live Releases" value={liveReleases.length} icon="🟢" />
        <StatCard title="Staging" value={stagingReleases.length} icon="🔵" />
        <StatCard title="Total Releases" value={releases.length} icon="📦" />
        <StatCard title="Analytics Events" value={analytics.length} icon="📈" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Live Releases</h2>
          {liveReleases.length === 0 ? (
            <p className="text-gray-500">No live releases</p>
          ) : (
            <div className="space-y-3">
              {liveReleases.map((release) => (
                <div
                  key={`${release.appId}-${release.jsVersion}-${release.bundleVersion}`}
                  className="flex items-center justify-between p-3 bg-gray-900 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{release.appId}</p>
                    <p className="text-xs text-gray-400">
                      v{release.jsVersion}.{release.bundleVersion} • Rollout: {release.rollout}%
                    </p>
                  </div>
                  <ReleaseBadge state={release.releaseState} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
          {recentHistory.length === 0 ? (
            <p className="text-gray-500">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 bg-gray-900 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-white">{entry.action}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{entry.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
