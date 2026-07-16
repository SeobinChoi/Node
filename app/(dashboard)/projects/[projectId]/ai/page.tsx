"use client";

import { useParams } from "next/navigation";
import { MilitaryAIConsole } from "@/components/project/MilitaryAIConsole";

export default function MilitaryAIPage() {
    const params = useParams();
    const projectId = params.projectId as string;

    return <MilitaryAIConsole projectId={projectId} />;
}
