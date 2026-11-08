import { SocialExperience } from "@/app/components/social-experience";
import { ConnectionsSkeleton } from "@/app/components/skeletons";
import { SessionExpired } from "@/app/components/workspace-shell";
import { getCurrentAccount } from "@/src/features/auth/session";
import { Suspense } from "react";

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<ConnectionsSkeleton />}>
      <AuthenticatedConnections />
    </Suspense>
  );
}

async function AuthenticatedConnections() {
  const account = await getCurrentAccount();
  if (!account) {
    return <SessionExpired />;
  }

  return <SocialExperience />;
}
