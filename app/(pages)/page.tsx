import { LinksFeedExperience } from "@/app/components/links-feed-experience";
import { SessionExpired } from "@/app/components/workspace-shell";
import { getCurrentAccount } from "@/src/features/auth/session";
import { Suspense } from "react";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground" role="status">
          Loading your feed...
        </p>
      }
    >
      <AuthenticatedFeed />
    </Suspense>
  );
}

async function AuthenticatedFeed() {
  const account = await getCurrentAccount();
  if (!account) {
    return <SessionExpired />;
  }

  return <LinksFeedExperience accountId={account.$id} />;
}
