"use client";

import { Camera, LoaderCircle, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PersonalPhotoLibrary } from "@/app/components/personal-photo-library";
import { UserAvatar } from "@/app/components/user-avatar";
import {
  deleteAvatar,
  fetchProfile,
  saveProfile as saveProfileRequest,
  uploadAvatar,
  type Profile,
} from "@/src/features/profile/client-api";
import { getApiErrorMessage } from "@/src/lib/api-client";

const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 10_000_000;

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
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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

  const changeAvatar = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setMessage("");

    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      setError("Choose a JPEG, PNG, or WebP photo.");
      return;
    }
    if (file.size === 0 || file.size > MAX_AVATAR_BYTES) {
      setError("Choose a photo smaller than 10 MB.");
      return;
    }

    setAvatarBusy(true);
    try {
      const { avatar } = await uploadAvatar(file);
      setProfile((current) => (current ? { ...current, avatar } : current));
      setMessage("Photo updated.");
    } catch (cause) {
      setError(
        getApiErrorMessage(
          cause,
          "We could not save your photo. Please try again.",
        ),
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    setError("");
    setMessage("");
    try {
      await deleteAvatar();
      setProfile((current) => (current ? { ...current, avatar: "" } : current));
      setMessage("Photo removed.");
    } catch (cause) {
      setError(
        getApiErrorMessage(
          cause,
          "We could not remove your photo. Please try again.",
        ),
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  const canHaveAvatar = Boolean(profile);
  const avatarButton = (
    <button
      aria-label="Change profile photo"
      className="group relative block shrink-0 rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-70"
      disabled={avatarBusy || !canHaveAvatar}
      onClick={() => avatarInputRef.current?.click()}
      title={canHaveAvatar ? "Change profile photo" : "Save your profile first"}
      type="button"
    >
      <UserAvatar
        avatar={profile?.avatar}
        className="size-20 sm:size-24"
        name={form.name}
        size={96}
        userId={accountId}
        username={form.username}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <Camera size={18} />
      </span>
      {avatarBusy && (
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center rounded-full bg-black/55 text-white"
        >
          <LoaderCircle className="animate-spin" size={20} />
        </span>
      )}
    </button>
  );

  return (
    <>
      <section
        aria-label="Profile"
        className="scroll-mt-6"
        id="profile"
      >
        {loading ? (
          <div className="flex items-center gap-4" role="status">
            <div className="size-20 animate-pulse rounded-full bg-muted sm:size-24" />
            <div className="grid gap-2">
              <div className="h-4 w-32 animate-pulse rounded-full bg-muted" />
              <div className="h-3 w-44 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
        ) : error && !editing ? (
          <div className="grid justify-items-start gap-2">
            <p className="text-xs leading-5 text-destructive" role="alert">
              {error}
            </p>
            <Button
              onClick={() => {
                setLoading(true);
                setRetry((current) => current + 1);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Try again
            </Button>
          </div>
        ) : editing ? (
          <form className="grid gap-3" onSubmit={saveProfile}>
            {!profile && (
              <p className="text-sm font-semibold">Create your profile</p>
            )}
            <div className="flex items-start gap-4">
              {avatarButton}
              <div className="grid min-w-0 flex-1 gap-2">
                <Input
                  aria-label="Username"
                  autoComplete="username"
                  className="h-9"
                  id="profile-username"
                  maxLength={30}
                  onChange={(event) => updateField("username", event.target.value)}
                  placeholder="username"
                  required
                  value={form.username}
                />
                <Input
                  aria-label="Name"
                  className="h-9"
                  id="profile-name"
                  maxLength={50}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Name (optional)"
                  value={form.name}
                />
              </div>
            </div>
            <Textarea
              aria-label="Bio"
              className="min-h-14 resize-none text-sm"
              id="profile-bio"
              maxLength={160}
              onChange={(event) => updateField("bio", event.target.value)}
              placeholder="Bio (optional)"
              rows={2}
              value={form.bio}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
                htmlFor="profile-private"
              >
                <Checkbox
                  checked={form.private}
                  id="profile-private"
                  onCheckedChange={(checked) => updateField("private", checked)}
                />
                Private account
              </label>
              {profile?.avatar && (
                <Button
                  className="text-muted-foreground"
                  disabled={avatarBusy}
                  onClick={() => void removeAvatar()}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" />
                  Remove photo
                </Button>
              )}
            </div>
            {error && (
              <p className="text-xs leading-5 text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              {profile && (
                <Button
                  disabled={saving}
                  onClick={cancelEditing}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
              )}
              <Button
                className="min-w-24"
                disabled={saving || !form.username.trim()}
                size="sm"
                type="submit"
              >
                {saving ? "Saving..." : profile ? "Save" : "Create profile"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-start gap-4">
            {avatarButton}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold leading-6">
                    @{profile?.username}
                  </h1>
                  {profile?.name && (
                    <p className="truncate text-[13px] text-muted-foreground">
                      {profile.name}
                    </p>
                  )}
                </div>
                <Button
                  aria-label="Edit profile"
                  onClick={() => {
                    setEditing(true);
                    setMessage("");
                  }}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <Pencil aria-hidden="true" />
                </Button>
              </div>
              {profile?.bio && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-snug">
                  {profile.bio}
                </p>
              )}
              <p className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <ShieldCheck aria-hidden="true" size={12} />
                {profile?.private ? "Private" : "Public"}
              </p>
            </div>
          </div>
        )}

        {message && (
          <p className="mt-2 text-[11px] text-muted-foreground" role="status">
            {message}
          </p>
        )}
      </section>

      <input
        accept={ACCEPTED_AVATAR_TYPES.join(",")}
        aria-hidden="true"
        className="sr-only"
        onChange={(event) => {
          void changeAvatar(event.target.files?.[0]);
          event.target.value = "";
        }}
        ref={avatarInputRef}
        tabIndex={-1}
        type="file"
      />

      <PersonalPhotoLibrary accountId={accountId} />
    </>
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
