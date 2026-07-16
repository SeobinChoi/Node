import type { Metadata } from "next";
import { MilitaryAIDemoClient } from "@/components/project/MilitaryAIDemoClient";

export const metadata: Metadata = {
  title: "Military AI Demo | Node",
  description: "Public interactive demo for Node military AI workflows using non-sensitive sample data.",
};

export default function MilitaryAIDemoPage() {
  return <MilitaryAIDemoClient />;
}
