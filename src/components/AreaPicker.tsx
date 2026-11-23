"use client";
import { useEffect, useId, useRef, useState } from "react";
import { fromMap, LOCALITIES, MAP_VIEW, nearestLocality, roundCoord, toMap, type Area } from "@/lib/areas";
import type { AreaPin } from "@/lib/profile";

type Suggestion = { id: string; label: string; secondary: string };
const newToken = () => (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join(""));

// Pick an area: search a locality, tap the map, or use your current location. Stores an area NAME and a
// rounded PIN only (never a street address). Writes hidden inputs `${name}Name|Lat|Lng` for the form.
export function AreaPicker({ name, label, hint, value, required, error }: {
  name: string; label: string; hint?: string; value: AreaPin | null; required?: boolean; error?: string;
}) {
  const [pin, setPin] = useState<AreaPin | null>(value);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const token = useRef(newToken());
  const seq = useRef(0);
  const listId = useId();

  // Search as you type: our server proxies Google when configured, otherwise the built-in list.
  useEffect(() => {
    const text = q.trim();
    const mine = ++seq.current;
    if (text.length < 2) return; // results are hidden below 2 characters (see shown)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/areas?q=${encodeURIComponent(text)}&token=${token.current}`);
        const j = await res.json();
        if (mine !== seq.current) return; // a newer keystroke superseded this answer
        if (!res.ok) throw new Error(j.error || "Search is unavailable");
        setResults(j.results);
        setNote(j.results.length ? (j.source === "google" ? "Powered by Google" : "") : "No match. Try another word or tap the map.");
      } catch (e) {
        if (mine === seq.current) { setResults([]); setNote(`${(e as Error).message}. You can tap the map instead.`); }
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Derived, not stored: suggestions only show while there is enough text to search on.
  const shown = q.trim().length >= 2 ? results : [];

  const choose = (a: Area) => { setPin({ name: a.name, lat: roundCoord(a.lat), lng: roundCoord(a.lng) }); setQ(""); setResults([]); setNote(""); setOpen(false); };

  async function pick(s: Suggestion) {
    setNote("Looking that up…");
    try {
      const res = await fetch(`/api/areas?id=${encodeURIComponent(s.id)}&token=${token.current}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Couldn't use that place");
      choose(j as Area);
      token.current = newToken(); // a search session ends with the lookup
    } catch (e) { setNote((e as Error).message); }
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setNote("Your browser can't share a location. Search or tap the map."); return; }
    setNote("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const near = nearestLocality(p);
        // Keep the area name (what we show) and the rounded pin; drop the rest of the precision.
        setPin({ name: near.name, lat: roundCoord(p.lat), lng: roundCoord(p.lng) });
        setNote("");
      },
      () => setNote("Couldn't get your location. Search or tap the map instead."),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  function onMapTap(e: React.MouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const p = fromMap((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    const near = nearestLocality(p);
    setPin({ name: near.name, lat: roundCoord(p.lat), lng: roundCoord(p.lng) });
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">
        {label} {required ? <span className="font-normal text-muted">(required)</span> : <span className="font-normal text-muted">(optional)</span>}
      </legend>
      {hint && <p className="text-sm text-muted">{hint}</p>}

      <input type="hidden" name={`${name}Name`} value={pin?.name ?? ""} />
      <input type="hidden" name={`${name}Lat`} value={pin?.lat ?? ""} />
      <input type="hidden" name={`${name}Lng`} value={pin?.lng ?? ""} />

      {pin && (
        <div className="flex items-center gap-3 rounded-2xl border border-brand bg-brand-soft px-3.5 py-3">
          <span aria-hidden className="text-lg">📍</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{pin.name}</p>
            <p className="text-xs text-muted">Bengaluru · area pin only, no street address</p>
          </div>
          <button type="button" onClick={() => setPin(null)} className="text-sm font-medium text-brand underline">Clear</button>
        </div>
      )}

      <div className="relative">
        <input
          type="search" role="combobox" aria-expanded={shown.length > 0} aria-controls={listId} aria-label={`Search ${label.toLowerCase()}`}
          autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a locality, e.g. Indiranagar"
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-3"
        />
        {shown.length > 0 && (
          <ul id={listId} role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
            {shown.map((s) => (
              <li key={s.id} role="option" aria-selected="false">
                <button type="button" onClick={() => pick(s)} className="block w-full px-3.5 py-2.5 text-left hover:bg-brand-soft">
                  <span className="font-medium">{s.label}</span>
                  {s.secondary && <span className="ml-2 text-xs text-muted">{s.secondary}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={useMyLocation} className="rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-medium">📍 Use my location</button>
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-medium">
          🗺️ {open ? "Hide map" : "Pick on map"}
        </button>
      </div>

      {open && <CityMap pin={pin} onTap={onMapTap} onPickArea={choose} />}

      <p role="status" className="min-h-4 text-xs text-muted">{note}</p>
      {error && !pin && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </fieldset>
  );
}

// Built-in Bengaluru map: a drawn city outline with tappable localities. Used until the Google Maps browser
// key is added; the pin it produces has the same shape, so nothing else changes when that happens.
// Only these get a printed name; every locality still has a dot, and a tap picks the nearest one.
const LABELLED = new Set(["Indiranagar", "Koramangala", "HSR Layout", "Jayanagar", "Malleshwaram", "Whitefield", "Hebbal", "Yelahanka", "Marathahalli", "MG Road", "Rajajinagar", "Bellandur"]);

function CityMap({ pin, onTap, onPickArea }: { pin: AreaPin | null; onTap: (e: React.MouseEvent<SVGSVGElement>) => void; onPickArea: (a: Area) => void }) {
  const W = 300, H = 330;
  const at = (p: { lat: number; lng: number }) => { const m = toMap(p); return { x: m.x * W, y: m.y * H }; };
  const pinAt = pin ? at(pin) : null;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <svg viewBox={`0 0 ${W} ${H}`} role="application" aria-label="Map of Bengaluru. Tap to drop a pin, or use the locality buttons." className="block w-full cursor-crosshair touch-manipulation" onClick={onTap}>
        <rect width={W} height={H} fill="var(--brand-soft)" opacity="0.5" />
        {[0.25, 0.5, 0.75].map((f) => <g key={f} stroke="var(--line)" strokeWidth="1"><line x1={W * f} y1="0" x2={W * f} y2={H} /><line x1="0" y1={H * f} x2={W} y2={H * f} /></g>)}
        {LOCALITIES.filter((a) => a.lat >= MAP_VIEW.minLat && a.lat <= MAP_VIEW.maxLat && a.lng >= MAP_VIEW.minLng && a.lng <= MAP_VIEW.maxLng).map((a) => {
          const { x, y } = at(a);
          return (
            <g key={a.name}>
              <circle cx={x} cy={y} r="3" fill="var(--muted)" />
              {LABELLED.has(a.name) && (
                <text x={x > W * 0.78 ? x - 5 : x + 5} y={y + 3} textAnchor={x > W * 0.78 ? "end" : "start"} fontSize="9" fontWeight="600" fill="var(--foreground)" pointerEvents="none">{a.name}</text>
              )}
            </g>
          );
        })}
        {pinAt && <g transform={`translate(${pinAt.x} ${pinAt.y})`} pointerEvents="none"><path d="M0 0 C-9 -12 -9 -24 0 -24 C9 -24 9 -12 0 0Z" fill="var(--brand)" /><circle cy="-16" r="3" fill="var(--brand-ink)" /></g>}
      </svg>
      <p className="border-t border-line px-3 py-2 text-xs text-muted">Tap anywhere to drop a pin, or choose a locality:</p>
      <div className="flex flex-wrap gap-1.5 px-3 pb-3">
        {LOCALITIES.slice(0, 12).map((a) => (
          <button key={a.name} type="button" onClick={() => onPickArea(a)} className="rounded-full border border-line px-2.5 py-1 text-xs hover:bg-brand-soft">{a.name}</button>
        ))}
      </div>
    </div>
  );
}
