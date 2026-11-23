"use client";
import { useRef, useState } from "react";

// Opens WhatsApp with the message ready, or copies the link. The visible link box means a person can always
// copy by hand even if the browser blocks clipboard access.
export function ShareActions({ link, whatsapp }: { link: string; whatsapp: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const box = useRef<HTMLInputElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      box.current?.select(); // clipboard blocked: select the text so Ctrl/Cmd+C works
      setState("failed");
    }
  }

  return (
    <div className="space-y-3">
      <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3.5 font-semibold text-black">
        <span aria-hidden>💬</span> Share on WhatsApp
      </a>
      <div className="flex gap-2">
        <input ref={box} readOnly value={link} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-3 text-sm" />
        <button type="button" onClick={copy} className="shrink-0 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold">
          {state === "copied" ? "Copied ✓" : "Copy link"}
        </button>
      </div>
      <p role="status" className="min-h-4 text-xs text-muted">
        {state === "failed" ? "Couldn't copy automatically. The link is selected: press Ctrl+C (or Cmd+C)." : ""}
      </p>
    </div>
  );
}
