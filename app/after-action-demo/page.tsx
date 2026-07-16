import type { Metadata } from "next";
import { PublicServiceDemoClient } from "@/components/project/PublicServiceDemoClient";

export const metadata: Metadata = {
  title: "After Action Demo | Node",
  description:
    "Public sample-data AAR and weekly report rollup demo for Node military-academic report evidence.",
};

export default function AfterActionDemoPage() {
  return <PublicServiceDemoClient variant="afterAction" />;
}
