import { PublicProfileExperience } from "@/app/components/public-profile-experience";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <PublicProfileExperience username={username} />;
}
