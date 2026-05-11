"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Sidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  currentOrgId: string;
  children: React.ReactNode;
}

export function DashboardShell({ currentOrgId, children }: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const isProjectWorkspace = /\/org\/[^/]+\/projects\/[^/]+/.test(pathname || "");

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-gray-50">
      <div className="hidden md:flex">
        <Sidebar currentOrgId={currentOrgId} variant="desktop" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-3 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open workspace navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link
            href={`/org/${currentOrgId}/projects`}
            className="truncate text-sm font-semibold"
          >
            Node
          </Link>
          <div className="h-9 w-9" aria-hidden="true" />
        </header>

        <main
          className={cn(
            "min-w-0 flex-1 bg-gray-50",
            isProjectWorkspace ? "overflow-hidden" : "overflow-y-auto"
          )}
        >
          <div
            className={cn(
              "mx-auto w-full",
              isProjectWorkspace
                ? "h-full max-w-none p-0"
                : "max-w-7xl px-4 py-5 sm:px-6 sm:py-8"
            )}
          >
            {children}
          </div>
        </main>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-[340px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Workspace navigation</SheetTitle>
          </SheetHeader>
          <Sidebar
            currentOrgId={currentOrgId}
            variant="mobile"
            onNavigate={() => setMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
