"use client";

import { MonitorCheck } from "lucide-react";

export type PublicDemoHeaderVariant = "militaryAi" | "opsRadar" | "adminDoc" | "afterAction";

const routeLinks: Array<{ label: string; href: string; variant: PublicDemoHeaderVariant }> = [
  { label: "문서지원", href: "/military-ai-demo", variant: "militaryAi" },
  { label: "과업상황", href: "/ops-radar-demo", variant: "opsRadar" },
  { label: "행정문서", href: "/admin-doc-demo", variant: "adminDoc" },
  { label: "사후조치", href: "/after-action-demo", variant: "afterAction" },
];

const headerThemes: Record<PublicDemoHeaderVariant, { background: string; border: string; text: string }> = {
  militaryAi: {
    background: "bg-slate-950",
    border: "border-slate-900",
    text: "text-slate-950",
  },
  opsRadar: {
    background: "bg-[#173f61]",
    border: "border-[#092943]",
    text: "text-[#173f61]",
  },
  adminDoc: {
    background: "bg-[#174f86]",
    border: "border-[#103c68]",
    text: "text-[#174f86]",
  },
  afterAction: {
    background: "bg-[#15523d]",
    border: "border-[#0f3e2e]",
    text: "text-[#15523d]",
  },
};

export function PublicDemoHeader({
  variant,
  title,
}: {
  variant: PublicDemoHeaderVariant;
  title: string;
}) {
  const theme = headerThemes[variant];

  return (
    <header className={`border-b text-white ${theme.background} ${theme.border}`}>
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center border border-white bg-white ${theme.text}`}>
            <MonitorCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white/75">Node 업무지원 공개 시연</p>
            <h1 className="truncate text-xl font-semibold tracking-normal text-white">{title}</h1>
            <p className="mt-1 text-sm leading-5 text-white/80">
              로그인 없이 생성, 저장, 내보내기를 확인하는 담당자 시연 화면
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap gap-1" aria-label="Public demos">
          {routeLinks.map((link) => {
            const isActive = link.variant === variant;
            const className = isActive
              ? `border-white bg-white ${theme.text}`
              : "border-white/35 bg-transparent text-white hover:bg-white/10";

            return (
              <a
                key={`${link.href}-${link.label}`}
                href={link.href}
                className={`border px-3 py-1.5 text-[13px] font-medium transition ${className}`}
              >
                {link.label}
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
