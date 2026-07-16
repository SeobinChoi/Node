import type { Metadata } from "next";
import { PublicServiceDemoClient } from "@/components/project/PublicServiceDemoClient";

export const metadata: Metadata = {
  title: "Ops Radar Demo | Node",
  description:
    "Public sample-data operations radar demo for Node military-academic report evidence.",
};

export default function OpsRadarDemoPage() {
  return <PublicServiceDemoClient variant="opsRadar" />;
}
