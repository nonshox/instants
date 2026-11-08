import { NotificationExperience } from "@/app/components/notification-experience";
import { NotificationsSkeleton } from "@/app/components/skeletons";
import { SessionExpired } from "@/app/components/workspace-shell";
import { getCurrentAccount } from "@/src/features/auth/session";
import { Suspense } from "react";

export default function NotificationsPage() {
  return (
    <Suspense fallback={<NotificationsSkeleton />}>
      <AuthenticatedNotifications />
    </Suspense>
  );
}

async function AuthenticatedNotifications() {
  const account = await getCurrentAccount();
  if (!account) {
    return <SessionExpired />;
  }

  return <NotificationExperience />;
}
