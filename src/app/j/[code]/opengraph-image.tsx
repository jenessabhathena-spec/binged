import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { requestTime } from "@/lib/now";
import { planStore } from "@/lib/plan-store";
import { formatWhen, INVITE_CODE } from "@/lib/plans";

export const alt = "A Binged plan invite";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The picture WhatsApp shows with the link: the plan name, who invited you and when. Anything that isn't a live
// invite gets the plain Binged card, which reveals nothing about whether the code ever existed.
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  await connection();
  const { code } = await params;
  const plan = INVITE_CODE.test(code) ? await planStore().getByInvite(code, requestTime()) : null;

  const name = plan?.name ?? "Agree on one place. Fast.";
  const line1 = plan ? `${plan.organiserFirstName} invited you` : "Everyone swipes. Binged finds the fairest match.";
  const line2 = plan ? `${formatWhen(plan.startsAt)} · ${plan.partySize} people` : "Bengaluru";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#fbf7f2", color: "#1e1b18" }}>
        <div style={{ display: "flex", fontSize: 56, fontWeight: 800, color: "#e2552d", letterSpacing: -1 }}>binged</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 40, color: "#6f675f" }}>{line1}</div>
          <div style={{ display: "flex", marginTop: 12, fontSize: name.length > 24 ? 72 : 104, fontWeight: 800, lineHeight: 1.05 }}>{name.slice(0, 50)}</div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 44, color: "#e2552d", fontWeight: 700 }}>{line2}</div>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#6f675f" }}>Takes 30 seconds. Nothing to install.</div>
      </div>
    ),
    { ...size },
  );
}
