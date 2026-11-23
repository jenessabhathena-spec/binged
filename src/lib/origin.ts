import "server-only";
// The public address of this app, for links people will paste into WhatsApp.
// NEXT_PUBLIC_APP_URL wins when set (production). Otherwise it is the address this request arrived on, so a
// link made while developing on any port works on that port.
import { headers } from "next/headers";
import { env } from "@/lib/env";

const HOST = /^[A-Za-z0-9.-]+(:\d{1,5})?$/;

export async function appOrigin(): Promise<string> {
  if (env.appUrl) return env.appUrl.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  if (!HOST.test(host)) return "http://localhost:3000";
  const proto = h.get("x-forwarded-proto") === "https" || (!/^localhost(:|$)|^127\./.test(host) && !h.get("x-forwarded-proto")) ? "https" : "http";
  return `${proto}://${host}`;
}
