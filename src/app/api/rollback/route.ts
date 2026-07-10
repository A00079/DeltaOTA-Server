import { NextRequest, NextResponse } from "next/server";
import { readJSON, writeJSON } from "@/lib/db";
import { Release, ReleaseState, HistoryEntry } from "@/lib/types";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { appId, jsVersion, bundleVersion } = body;

    if (!appId || jsVersion === undefined) {
      return NextResponse.json(
        { error: "appId and jsVersion are required" },
        { status: 400 }
      );
    }

    const releases = readJSON<Release[]>("releases.json");
    const now = new Date().toISOString();

    let targetIndex: number;

    if (bundleVersion !== undefined) {
      targetIndex = releases.findIndex(
        (r) =>
          r.appId === appId &&
          r.jsVersion === jsVersion &&
          r.bundleVersion === bundleVersion &&
          r.releaseState === ReleaseState.LIVE
      );
    } else {
      const liveReleases = releases
        .map((r, i) => ({ release: r, index: i }))
        .filter(
          ({ release }) =>
            release.appId === appId &&
            release.jsVersion === jsVersion &&
            release.releaseState === ReleaseState.LIVE
        )
        .sort((a, b) => b.release.bundleVersion - a.release.bundleVersion);

      targetIndex = liveReleases.length > 0 ? liveReleases[0].index : -1;
    }

    if (targetIndex === -1) {
      return NextResponse.json(
        { error: "No live release found to rollback" },
        { status: 404 }
      );
    }

    const previousState = releases[targetIndex].releaseState;
    releases[targetIndex].releaseState = ReleaseState.DISABLED;
    releases[targetIndex].updatedAt = now;

    writeJSON("releases.json", releases);

    const history = readJSON<HistoryEntry[]>("history.json");
    history.push({
      id: randomUUID(),
      appId,
      jsVersion,
      bundleVersion: releases[targetIndex].bundleVersion,
      action: "ROLLBACK",
      previousState,
      newState: ReleaseState.DISABLED,
      timestamp: now,
      description: `Rollback: release disabled for appId=${appId}, jsVersion=${jsVersion}, bundleVersion=${releases[targetIndex].bundleVersion}`,
    });
    writeJSON("history.json", history);

    return NextResponse.json({
      success: true,
      release: releases[targetIndex],
      message: `Release bundleVersion=${releases[targetIndex].bundleVersion} has been disabled. SDK will trigger rollback.`,
    });
  } catch (error) {
    console.error("POST /api/rollback error:", error);
    return NextResponse.json(
      { error: "Failed to rollback" },
      { status: 500 }
    );
  }
}
