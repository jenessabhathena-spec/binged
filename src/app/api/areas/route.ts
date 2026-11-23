// GET /api/areas?q=indira          -> suggestions
// GET /api/areas?id=<place or area> -> { name, lat, lng } (rounded, Bengaluru only)
// Signed-in callers only (friends joining get access in M4), with a per-IP limit: Google calls cost money.
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { areaDetails, searchAreas } from "@/lib/places/autocomplete";

const hits = new Map<string, number[]>();
function limited(ip: string, max = 60, windowMs = 60_000) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > max;
}

export async function GET(request: NextRequest) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const ip = request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "local";
  if (limited(ip)) return NextResponse.json({ error: "Too many searches. Wait a moment." }, { status: 429 });

  const sp = request.nextUrl.searchParams;
  const token = sp.get("token");
  const id = sp.get("id");
  if (id) {
    if (id.length > 300) return NextResponse.json({ error: "Bad id" }, { status: 400 });
    try {
      const area = await areaDetails(id, token);
      return area ? NextResponse.json(area) : NextResponse.json({ error: "That place isn't in Bengaluru" }, { status: 422 });
    } catch {
      return NextResponse.json({ error: "Couldn't look that place up. Try another, or drop a pin." }, { status: 502 });
    }
  }
  const q = (sp.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ source: "local", results: [] });
  if (q.length > 80) return NextResponse.json({ error: "Search is too long" }, { status: 400 });
  const r = await searchAreas(q, token);
  return NextResponse.json({ ...r, results: r.results.slice(0, 6) });
}
