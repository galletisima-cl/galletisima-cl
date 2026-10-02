import { NextResponse } from "next/server";
import { loadInstagramFeed } from "../../../../lib/instagram";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  try {
    return NextResponse.json(await loadInstagramFeed(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    // A missing connection or temporary outage must not break the storefront.
    return NextResponse.json({ username: null, posts: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
