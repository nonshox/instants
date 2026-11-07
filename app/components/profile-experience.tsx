"use client";

import { Pencil, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PersonalPhotoLibrary } from "@/app/components/personal-photo-library";
import {
  fetchProfile,
  saveProfile as saveProfileRequest,
  type Profile,
} from "@/src/features/profile/client-api";
import { getApiErrorMessage } from "@/src/lib/api-client";

type ProfileForm = {
  username: string;
  name: string;
  bio: string;
  private: boolean;
};

const emptyProfile: ProfileForm = {
  username: "",
  name: "",
  bio: "",
  private: true,
};

export function ProfileExperience({ accountId }: { accountId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState(emptyProfile);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    fetchProfile()
      .then((data) => {
        if (!active) {
          return;
        }

        setProfile(data);
        setForm(data ? toForm(data) : emptyProfile);
        setEditing(!data);
        setError("");
      })
      .catch(() => {
        if (active) {
          setError("We could not load your profile.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [retry]);

  const updateField = <Key extends keyof ProfileForm>(
    key: Key,
    value: ProfileForm[Key],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const saved = await saveProfileRequest(form, Boolean(profile));
      setProfile(saved);
      setForm(toForm(saved));
      setEditing(false);
      setMessage(profile ? "Profile updated." : "Profile created.");
    } catch (cause) {
      setError(
        getApiErrorMessage(
          cause,
          "We could not save your profile. Please try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const cancelEditing = () => {
    if (profile) {
      setForm(toForm(profile));
      setEditing(false);
    }

    setError("");
    setMessage("");
  };

  return (
    <div>
    <Card
      aria-labelledby="profile-title"
      className="mt-8 scroll-mt-6 gap-0 py-0 shadow-none"
      id="profile"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b px-5 py-4">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Profile
          </p>
          <CardTitle className="text-xl font-semibold tracking-tight" id="profile-title">
            {profile ? "Your profile" : "Create your profile"}
          </CardTitle>
        </div>
        {profile && !editing && (
          <Button
            onClick={() => {
              setEditing(true);
              setMessage("");
            }}
            type="button"
            variant="outline"
          >
            <Pencil aria-hidden="true" size={15} />
            Edit
          </Button>
        )}
      </CardHeader>

      <CardContent className="px-5 py-4">
        {loading ? (
          <p className="py-2 text-xs text-muted-foreground">Loading profile...</p>
        ) : error && !editing ? (
          <div>
            <p className="my-1 text-xs leading-5 text-destructive" role="alert">
              {error}
            </p>
            <Button
              onClick={() => {
                setLoading(true);
                setRetry((current) => current + 1);
              }}
              type="button"
              variant="outline"
            >
              Try again
            </Button>
          </div>
        ) : editing ? (
          <form className="grid gap-4 pt-1" onSubmit={saveProfile}>
            <div className="grid gap-2">
              <Label htmlFor="profile-username">Username</Label>
              <Input
                autoComplete="username"
                id="profile-username"
                maxLength={30}
                required
                value={form.username}
                onChange={(event) => updateField("username", event.target.value)}
                placeholder="Choose a username"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                maxLength={50}
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Your name (optional)"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-bio">Bio</Label>
              <Textarea
                id="profile-bio"
                rows={3}
                value={form.bio}
                onChange={(event) => updateField("bio", event.target.value)}
                placeholder="A little about you (optional)"
              />
            </div>
            <label
              className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted p-3"
              htmlFor="profile-private"
            >
              <Checkbox
                checked={form.private}
                id="profile-private"
                onCheckedChange={(checked) => updateField("private", checked)}
              />
              <span className="grid gap-1">
                <strong className="text-sm font-medium">Private account</strong>
                <small className="text-[11px] leading-5 text-muted-foreground">
                  Only approved followers can see your Instants.
                </small>
              </span>
            </label>
            {error && (
              <p className="my-1 text-xs leading-5 text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              {profile && (
                <Button
                  disabled={saving}
                  onClick={cancelEditing}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
              )}
              <Button
                className="min-w-[134px]"
                disabled={saving || !form.username.trim()}
                type="submit"
              >
                {saving
                  ? "Saving..."
                  : profile
                    ? "Save changes"
                    : "Create profile"}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="py-2">
              <p className="m-0 text-sm font-semibold">
                @{profile?.username}
              </p>
              {profile?.name && (
                <p className="mb-0 mt-2 text-xs text-muted-foreground">
                  {profile.name}
                </p>
              )}
              {profile?.bio && (
                <p className="mb-0 mt-2 text-xs leading-5 text-muted-foreground">
                  {profile.bio}
                </p>
              )}
              <p className="mb-0 mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck aria-hidden="true" size={15} />
                {profile?.private ? "Private account" : "Public account"}
              </p>
            </div>
            {message && (
              <p className="mb-0 mt-3 text-xs text-muted-foreground" role="status">
                {message}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
    <PersonalPhotoLibrary accountId={accountId} />
    </div>
  );
}

function toForm(profile: Profile): ProfileForm {
  return {
    username: profile.username,
    name: profile.name,
    bio: profile.bio,
    private: profile.private,
  };
}
