import { InstantExperience } from "@/app/components/instant-experience";
import { CreateSkeleton } from "@/app/components/skeletons";
import { SessionExpired } from "@/app/components/workspace-shell";
import { getCurrentAccount } from "@/src/features/auth/session";
import { Suspense } from "react";

export default function CreatePage() {
  return (
    <Suspense fallback={<CreateSkeleton />}>
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
