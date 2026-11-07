import { SocialExperience } from "@/app/components/social-experience";

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab =
    tab === "followers" || tab === "following" || tab === "requests"
      ? tab
      : "followers";
  return <SocialExperience initialTab={initialTab} />;
}
