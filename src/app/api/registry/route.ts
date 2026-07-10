import { NextRequest, NextResponse } from "next/server";
import { readJSON, writeJSON } from "@/lib/db";
import { Registry } from "@/lib/types";
import { validateRegistry } from "@/lib/validation";

export async function GET(): Promise<NextResponse> {
  try {
    const registry = readJSON<Registry[]>("registry.json");
    return NextResponse.json({ apps: registry });
  } catch (error) {
    console.error("GET /api/registry error:", error);
    return NextResponse.json(
      { error: "Failed to fetch registry" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    const validation = validateRegistry(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const registry = readJSON<Registry[]>("registry.json");

    const existing = registry.find(
      (r) => r.appId === body.appId && r.platform === body.platform
    );

    if (existing) {
      return NextResponse.json(
        { error: `App already registered: ${body.appId} (${body.platform})` },
        { status: 409 }
      );
    }

    const newApp: Registry = {
      appId: body.appId,
      platform: body.platform,
      appName: body.appName,
      createdAt: new Date().toISOString(),
    };

    registry.push(newApp);
    writeJSON("registry.json", registry);

    return NextResponse.json({ app: newApp }, { status: 201 });
  } catch (error) {
    console.error("POST /api/registry error:", error);
    return NextResponse.json(
      { error: "Failed to register app" },
      { status: 500 }
    );
  }
}
