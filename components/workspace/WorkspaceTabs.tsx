"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type WorkspaceTab = "all" | "recents" | "favorites" | "unfiled";

interface WorkspaceTabsProps {
    activeTab: WorkspaceTab;
    onTabChange: (tab: WorkspaceTab) => void;
    counts?: {
        all: number;
        recents: number;
        favorites: number;
        unfiled: number;
    };
}

export function WorkspaceTabs({ activeTab, onTabChange, counts }: WorkspaceTabsProps) {
    return (
        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as WorkspaceTab)}>
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList className="inline-flex h-auto min-w-max bg-[#f7f7f5] border border-[#e8e8e6]">
                <TabsTrigger
                    value="all"
                    className="shrink-0 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                    All
                    {counts && counts.all > 0 && (
                        <span className="ml-1.5 text-xs text-muted-foreground">({counts.all})</span>
                    )}
                </TabsTrigger>
                <TabsTrigger
                    value="recents"
                    className="shrink-0 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                    Recents
                    {counts && counts.recents > 0 && (
                        <span className="ml-1.5 text-xs text-muted-foreground">({counts.recents})</span>
                    )}
                </TabsTrigger>
                <TabsTrigger
                    value="favorites"
                    className="shrink-0 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                    Favorites
                    {counts && counts.favorites > 0 && (
                        <span className="ml-1.5 text-xs text-muted-foreground">({counts.favorites})</span>
                    )}
                </TabsTrigger>
                <TabsTrigger
                    value="unfiled"
                    className="shrink-0 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                    Unfiled
                    {counts && counts.unfiled > 0 && (
                        <span className="ml-1.5 text-xs text-muted-foreground">({counts.unfiled})</span>
                    )}
                </TabsTrigger>
            </TabsList>
            </div>
        </Tabs>
    );
}
