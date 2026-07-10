import { NextRequest, NextResponse } from "next/server";
import { readJSON, writeJSON } from "@/lib/db";
import { Release, ReleaseState, HistoryEntry } from "@/lib/types";
import { validateStateTransition, validateRollout } from "@/lib/validation";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    const { appId, jsVersion, bundleVersion, releaseState, rollout, description } = body;

    if (!appId || jsVersion === undefined || bundleVersion === undefined) {
      return NextResponse.json(
        { error: "appId, jsVersion, and bundleVersion are required" },
        { status: 400 }
      );
    }

    const releases = readJSON<Release[]>("releases.json");

    const releaseIndex = releases.findIndex(
      (r) =>
        r.appId === appId &&
        r.jsVersion === jsVersion &&
        r.bundleVersion === bundleVersion
    );

    if (releaseIndex === -1) {
      return NextResponse.json(
        { error: "Release not found" },
        { status: 404 }
      );
    }

    const release = releases[releaseIndex];
    const now = new Date().toISOString();
    const historyEntries: HistoryEntry[] = [];

    if (releaseState !== undefined) {
      const newState = releaseState as ReleaseState;
      const stateValidation = validateStateTransition(release.releaseState, newState);
      if (!stateValidation.valid) {
        return NextResponse.json(
          { error: stateValidation.error },
          { status: 400 }
        );
      }

      historyEntries.push({
        id: randomUUID(),
        appId,
        jsVersion,
        bundleVersion,
        action: "STATE_CHANGED",
        previousState: release.releaseState,
        newState,
        timestamp: now,
        description: `State changed from ${release.releaseState} to ${newState}`,
      });

      release.releaseState = newState;
    }

    if (rollout !== undefined) {
      const rolloutValidation = validateRollout(release.rollout, rollout);
      if (!rolloutValidation.valid) {
        return NextResponse.json(
          { error: rolloutValidation.error },
          { status: 400 }
        );
      }

      historyEntries.push({
        id: randomUUID(),
        appId,
        jsVersion,
        bundleVersion,
        action: "ROLLOUT_UPDATED",
        rollout,
        timestamp: now,
        description: `Rollout updated from ${release.rollout}% to ${rollout}%`,
      });

      release.rollout = rollout;
    }

    if (description !== undefined) {
      release.description = description;
    }

    release.updatedAt = now;
    releases[releaseIndex] = release;
    writeJSON("releases.json", releases);

    if (historyEntries.length > 0) {
      const history = readJSON<HistoryEntry[]>("history.json");
      history.push(...historyEntries);
      writeJSON("history.json", history);
    }

    return NextResponse.json({ release });
  } catch (error) {
    console.error("POST /api/releases/update error:", error);
    return NextResponse.json(
      { error: "Failed to update release" },
      { status: 500 }
    );
  }
}
