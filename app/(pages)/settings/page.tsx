import { SettingsExperience } from "@/app/components/settings-experience";
import { getCurrentAccountData } from "@/src/features/auth/session";
import { SessionExpired } from "@/app/components/workspace-shell";
import { Suspense } from "react";

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground" role="status">
          Loading settings...
        </p>
      }
    >
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
