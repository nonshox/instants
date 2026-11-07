import { InstantExperience } from "@/app/components/instant-experience";
import { SessionExpired } from "@/app/components/workspace-shell";
import { getCurrentAccount } from "@/src/features/auth/session";
import { Suspense } from "react";

export default function InstantPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground" role="status">
          Loading your Instants...
        </p>
      }
    >
      <AuthenticatedInstants />
    </Suspense>
  );
}

async function AuthenticatedInstants() {
  const account = await getCurrentAccount();
  if (!account) {
    return <SessionExpired />;
  }

  return <InstantExperience accountId={account.$id} />;
}
