import { AccountExperience } from "@/app/components/account-experience";
import { getCurrentAccountData } from "@/src/features/auth/session";
import { SessionExpired } from "@/app/components/workspace-shell";
import { Suspense } from "react";
import { PrivacySettings } from "@/app/components/privacy-settings";

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

  return (
    <>
      <AccountExperience
        email={accountData.user.email}
        initialSessions={accountData.sessions}
      />
      <PrivacySettings />
    </>
  );
}
