import type { Metadata } from "next";
import { DemoApp } from "./DemoApp";

export const metadata: Metadata = {
  title: "Try the demo",
  description: "See Binged end to end in two minutes: swipe, shortlist, compare, and a winner. No sign-in.",
};

export default function DemoPage() {
  return <DemoApp />;
}
