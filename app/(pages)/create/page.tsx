import { InstantExperience } from "@/app/components/instant-experience";
import { SessionExpired } from "@/app/components/workspace-shell";
import { getCurrentAccount } from "@/src/features/auth/session";
import { Suspense } from "react";

export default function CreatePage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground" role="status">
          Loading your Instants...
        </p>
      }
    >
      <AuthenticatedCreate />
    </Suspense>
  );
}

async function AuthenticatedCreate() {
  const account = await getCurrentAccount();
  if (!account) {
    return <SessionExpired />;
  }

  return <InstantExperience accountId={account.$id} />;
}
