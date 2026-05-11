import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  return <DashboardShell currentOrgId={orgId}>{children}</DashboardShell>;
}
