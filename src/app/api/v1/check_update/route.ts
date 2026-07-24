import { NextRequest, NextResponse } from "next/server";
import { readBlobJSON } from "@/lib/blob-db";
import { Release, ReleaseState } from "@/lib/types";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;

    const appId = searchParams.get("appId");
    const jsVersionStr = searchParams.get("jsVersion");
    const bundleVersionStr = searchParams.get("bundleVersion");
    const bucketStr = searchParams.get("bucket");
    const iuStr = searchParams.get("iu");

    if (!appId || !jsVersionStr || !bundleVersionStr || !bucketStr) {
      return NextResponse.json(
        { data: { isUpdateAvailable: false } },
        { status: 400 }
      );
    }

    const jsVersion = parseInt(jsVersionStr, 10);
    const bundleVersion = parseInt(bundleVersionStr, 10);
    const bucket = parseInt(bucketStr, 10);
    const isInternalUser = iuStr === "true" || iuStr === "1";

    if (isNaN(jsVersion) || isNaN(bundleVersion) || isNaN(bucket)) {
      return NextResponse.json(
        { data: { isUpdateAvailable: false } },
        { status: 400 }
      );
    }

    // Read releases from Vercel Blob
    const releases = await readBlobJSON<Release[]>("releases.json", []);

    const appReleases = releases.filter(
      (r) => r.appId === appId && r.jsVersion === jsVersion
    );

    if (appReleases.length === 0) {
      return NextResponse.json({ data: { isUpdateAvailable: false } });
    }

    const clientRelease = appReleases.find(
      (r) => r.bundleVersion === bundleVersion
    );

    if (
      clientRelease &&
      (clientRelease.releaseState === ReleaseState.DISABLED ||
        clientRelease.releaseState === ReleaseState.DELETED)
    ) {
      return NextResponse.json({ data: { isUpdateAvailable: false, rollback: true } });
    }

    const visibleStates: ReleaseState[] = isInternalUser
      ? [ReleaseState.STAGING, ReleaseState.LIVE]
      : [ReleaseState.LIVE];

    const eligibleReleases = appReleases.filter((r) => {
      if (!visibleStates.includes(r.releaseState)) {
        return false;
      }

      if (r.bundleVersion <= bundleVersion) {
        return false;
      }

      if (r.releaseState === ReleaseState.LIVE && !isInternalUser) {
        if (bucket > r.rollout) {
          return false;
        }
      }

      return true;
    });

    if (eligibleReleases.length === 0) {
      return NextResponse.json({ data: { isUpdateAvailable: false } });
    }

    const latestRelease = eligibleReleases.reduce((latest, current) =>
      current.bundleVersion > latest.bundleVersion ? current : latest
    );

    const patchKey = String(bundleVersion);
    const patchUrl =
      latestRelease.patches && latestRelease.patches[patchKey]
        ? latestRelease.patches[patchKey]
        : latestRelease.patchUrl;

    return NextResponse.json({
      data: {
        isUpdateAvailable: true,
        isMandatory: latestRelease.isMandatory,
        hash: latestRelease.hash,
        jsVersion: latestRelease.jsVersion,
        bundleVersion: latestRelease.bundleVersion,
        patchUrl: patchUrl || null,
        bundleUrl: latestRelease.bundleUrl,
      }
    });
  } catch (error) {
    console.error("check_update error:", error);
    return NextResponse.json({ data: { isUpdateAvailable: false } }, { status: 500 });
  }
}
