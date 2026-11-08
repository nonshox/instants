import { SettingsExperience } from "@/app/components/settings-experience";
import { SettingsSkeleton } from "@/app/components/skeletons";
import { getCurrentAccountData } from "@/src/features/auth/session";
import { SessionExpired } from "@/app/components/workspace-shell";
import { Suspense } from "react";

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <AuthenticatedSettings />
    </Suspense>
  );
}

async function AuthenticatedSettings() {
  const accountData = await getCurrentAccountData();
  if (!accountData) {
    return <SessionExpired />;
  }

  return <SettingsExperience
    email={accountData.user.email}
    initialSessions={accountData.sessions}
  />;
}
