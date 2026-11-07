import { ProfileExperience } from "@/app/components/profile-experience";
import { SessionExpired } from "@/app/components/workspace-shell";
import { getCurrentAccount } from "@/src/features/auth/session";
import { Suspense } from "react";

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground" role="status">
          Loading your profile...
        </p>
      }
    >
      <AuthenticatedProfile />
    </Suspense>
  );
}

async function AuthenticatedProfile() {
  const account = await getCurrentAccount();
  if (!account) {
    return <SessionExpired />;
  }

  return <ProfileExperience accountId={account.$id} />;
}
