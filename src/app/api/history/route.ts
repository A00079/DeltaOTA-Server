import { NextRequest, NextResponse } from "next/server";
import { readBlobJSON } from "@/lib/blob-db";
import { HistoryEntry } from "@/lib/types";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const appId = searchParams.get("appId");
    const limitStr = searchParams.get("limit");

    let history = await readBlobJSON<HistoryEntry[]>("history.json", []);

    if (appId) {
      history = history.filter((h) => h.appId === appId);
    }

    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const recentHistory = history.slice(-limit).reverse();

    return NextResponse.json({ history: recentHistory, total: history.length });
  } catch (error) {
    console.error("GET /api/history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
