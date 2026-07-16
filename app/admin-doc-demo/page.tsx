import type { Metadata } from "next";
import { PublicServiceDemoClient } from "@/components/project/PublicServiceDemoClient";

export const metadata: Metadata = {
  title: "Admin Doc Demo | Node",
  description:
    "Public sample-data administrative document drafting demo for Node military-academic report evidence.",
};

export default function AdminDocDemoPage() {
  return <PublicServiceDemoClient variant="adminDoc" />;
}
