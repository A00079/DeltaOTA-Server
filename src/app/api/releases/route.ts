import { NextRequest, NextResponse } from "next/server";
import { readJSON, writeJSON } from "@/lib/db";
import { Release, ReleaseState, HistoryEntry } from "@/lib/types";
import { validateRelease } from "@/lib/validation";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const appId = searchParams.get("appId");
    const jsVersionStr = searchParams.get("jsVersion");
    const releaseStateStr = searchParams.get("releaseState");

    let releases = readJSON<Release[]>("releases.json");

    if (appId) {
      releases = releases.filter((r) => r.appId === appId);
    }

    if (jsVersionStr) {
      const jsVersion = parseInt(jsVersionStr, 10);
      if (!isNaN(jsVersion)) {
        releases = releases.filter((r) => r.jsVersion === jsVersion);
      }
    }

    if (releaseStateStr) {
      const releaseState = parseInt(releaseStateStr, 10);
      if (!isNaN(releaseState)) {
        releases = releases.filter((r) => r.releaseState === releaseState);
      }
    }

    return NextResponse.json({ releases });
  } catch (error) {
    console.error("GET /api/releases error:", error);
    return NextResponse.json(
      { error: "Failed to fetch releases" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    const validation = validateRelease(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const releases = readJSON<Release[]>("releases.json");

    const duplicate = releases.find(
      (r) =>
        r.appId === body.appId &&
        r.jsVersion === body.jsVersion &&
        r.bundleVersion === body.bundleVersion
    );

    if (duplicate) {
      return NextResponse.json(
        {
          error: `Release already exists for appId=${body.appId}, jsVersion=${body.jsVersion}, bundleVersion=${body.bundleVersion}`,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const newRelease: Release = {
      appId: body.appId,
      platform: body.platform,
      jsVersion: body.jsVersion,
      bundleVersion: body.bundleVersion,
      releaseState: ReleaseState.CREATED,
      rollout: 0,
      hash: body.hash,
      bundleUrl: body.bundleUrl,
      patchUrl: body.patchUrl || undefined,
      patches: body.patches || undefined,
      isMandatory: body.isMandatory || false,
      description: body.description || "",
      appVersion: body.appVersion || undefined,
      createdAt: now,
      updatedAt: now,
    };

    releases.push(newRelease);
    writeJSON("releases.json", releases);

    const history = readJSON<HistoryEntry[]>("history.json");
    history.push({
      id: randomUUID(),
      appId: newRelease.appId,
      jsVersion: newRelease.jsVersion,
      bundleVersion: newRelease.bundleVersion,
      action: "RELEASE_CREATED",
      newState: ReleaseState.CREATED,
      timestamp: now,
      description: `Release created: ${newRelease.description}`,
    });
    writeJSON("history.json", history);

    return NextResponse.json({ release: newRelease }, { status: 201 });
  } catch (error) {
    console.error("POST /api/releases error:", error);
    return NextResponse.json(
      { error: "Failed to create release" },
      { status: 500 }
    );
  }
}
