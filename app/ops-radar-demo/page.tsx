import type { Metadata } from "next";
import { OpsRadarDemoClient } from "@/components/project/ops-radar/OpsRadarDemoClient";

export const metadata: Metadata = {
  title: "Ops Radar Demo | Node",
  description:
    "Public sample-data operations radar demo for Node military-academic report evidence.",
};

export default function OpsRadarDemoPage() {
  return <OpsRadarDemoClient />;
}
