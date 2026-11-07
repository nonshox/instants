import { apiClient } from "@/src/lib/api-client";

export type Profile = {
  username: string;
  name: string;
  bio: string;
  avatar: string;
  private: boolean;
};

export type ProfileInput = Pick<Profile, "username" | "name" | "bio" | "private">;

export async function fetchProfile(): Promise<Profile | null> {
  const { data } = await apiClient.get<{ profile: Profile | null }>("/profile");
  return data.profile;
}

export async function saveProfile(
  input: ProfileInput,
  exists: boolean,
): Promise<Profile> {
  const { data } = exists
    ? await apiClient.patch<{ profile: Profile }>("/profile", input)
    : await apiClient.post<{ profile: Profile }>("/profile", input);
  return data.profile;
}
