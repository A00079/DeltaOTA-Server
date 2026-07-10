import { NextRequest, NextResponse } from "next/server";
import { readJSON, writeJSON } from "@/lib/db";
import { AnalyticsEvent } from "@/lib/types";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const appId = searchParams.get("appId");
    const event = searchParams.get("event");
    const limitStr = searchParams.get("limit");

    let analytics = readJSON<AnalyticsEvent[]>("analytics.json");

    if (appId) {
      analytics = analytics.filter((a) => a.appId === appId);
    }

    if (event) {
      analytics = analytics.filter((a) => a.event === event);
    }

    const limit = limitStr ? parseInt(limitStr, 10) : 100;
    const recentEvents = analytics.slice(-limit);

    const eventCounts: Record<string, number> = {};
    for (const entry of analytics) {
      eventCounts[entry.event] = (eventCounts[entry.event] || 0) + 1;
    }

    return NextResponse.json({
      events: recentEvents,
      counts: eventCounts,
      total: analytics.length,
    });
  } catch (error) {
    console.error("GET /api/analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    const { appId, event, jsVersion, bundleVersion, metadata } = body;

    if (!appId || !event) {
      return NextResponse.json(
        { error: "appId and event are required" },
        { status: 400 }
      );
    }

    const analytics = readJSON<AnalyticsEvent[]>("analytics.json");

    const newEvent: AnalyticsEvent = {
      id: randomUUID(),
      appId,
      event,
      jsVersion: jsVersion || 0,
      bundleVersion: bundleVersion || 0,
      timestamp: new Date().toISOString(),
      metadata: metadata || undefined,
    };

    analytics.push(newEvent);
    writeJSON("analytics.json", analytics);

    return NextResponse.json({ success: true, event: newEvent }, { status: 201 });
  } catch (error) {
    console.error("POST /api/analytics error:", error);
    return NextResponse.json(
      { error: "Failed to log event" },
      { status: 500 }
    );
  }
}
