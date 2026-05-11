"use client";

import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Sparkles } from "lucide-react";
import { ActionCenter } from "@/components/action-center/ActionCenter";

export default function HomePage() {
    const params = useParams();
    const { data: session } = useSession();
    const orgId = params.orgId as string;

    const firstName = session?.user?.name?.split(" ")[0] || "there";

    // Get current hour for greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

    return (
        <div className="mx-auto max-w-5xl space-y-6 pb-16 sm:space-y-8 sm:pb-20">
            {/* Header section with Greeting and Stats Summary (Placeholder for now as optional) */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <h1 className="mb-2 flex items-center text-2xl font-bold text-foreground sm:text-3xl">
                        <span className="truncate">{greeting}, {firstName}</span>
                        <Sparkles className="ml-2 inline h-5 w-5 shrink-0 animate-pulse text-yellow-400 sm:h-6 sm:w-6" />
                    </h1>
                    <p className="text-base text-muted-foreground sm:text-lg">Here is your action plan for today.</p>
                </div>
                {/* Optional Summary Strip could go here, e.g. "5 Actions", "3 Waiting" small count cards */}
            </div>

            {/* Global Action Center - Primary Section */}
            <section className="space-y-4">
                <ActionCenter orgId={orgId} />
            </section>
        </div>
    );
}
