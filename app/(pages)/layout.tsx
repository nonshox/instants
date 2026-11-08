import { Suspense } from "react";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { WorkspaceLoading } from "@/app/components/workspace-loading";
import { getCurrentAccount } from "@/src/features/auth/session";

export const instant = false;

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={<WorkspaceLoading />}
    >
      <ProtectedWorkspace>{children}</ProtectedWorkspace>
    </Suspense>
  );
}

async function ProtectedWorkspace({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await getCurrentAccount();
  if (!account) {
    redirect("/auth");
  }

  return <WorkspaceShell accountId={account.$id}>{children}</WorkspaceShell>;
}
