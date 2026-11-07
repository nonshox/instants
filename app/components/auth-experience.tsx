"use client";

import Image from "next/image";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchCurrentUser,
  requestEmailCode,
  verifyEmailCode,
} from "@/src/features/auth/client-api";
import { useInstantStore } from "@/src/features/instants/store";
import { useNotificationStore } from "@/src/features/notifications/store";
import { getApiErrorMessage } from "@/src/lib/api-client";

export function AuthExperience() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [userId, setUserId] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [pendingAction, setPendingAction] = useState<"send" | "verify" | null>(
    null,
  );
  const [error, setError] = useState("");
  const isPending = pendingAction !== null;

  const sendCode = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setPendingAction("send");
    setError("");

    try {
      setUserId(await requestEmailCode(email.trim()));
      setCode("");
      setStep("code");
    } catch (cause) {
      setError(
        getApiErrorMessage(cause, "We could not send a sign-in code."),
      );
    } finally {
      setPendingAction(null);
    }
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPendingAction("verify");
    setError("");

    try {
      await verifyEmailCode(userId, code);
      const user = await fetchCurrentUser();
      if (!user) {
        setError("Sign-in could not be completed. Request a new code and try again.");
        return;
      }
      useInstantStore.getState().reset();
      useNotificationStore.getState().reset();
      router.replace("/");
    } catch (cause) {
      setError(getApiErrorMessage(cause, "That code could not be verified."));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <main className="mx-auto grid min-h-svh w-full max-w-6xl grid-rows-[auto_1fr] bg-background md:grid-cols-2 md:grid-rows-1 md:items-center md:px-8">
      <div className="flex items-center justify-center px-4 pt-4 md:p-8 [@media(max-height:500px)]:hidden">
        <div className="relative h-[clamp(6rem,20svh,12rem)] w-full overflow-hidden rounded-2xl md:aspect-square md:h-auto md:max-w-[min(42vw,40rem)]">
          <Image
            alt="Sunlit fields"
            className="object-cover"
            fill
            priority
            sizes="(max-width: 767px) 100vw, 42vw"
            src="/auth.png"
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Image
              alt=""
              aria-hidden="true"
              className="size-12 border-4 border-black/40 rounded-lg object-cover"
              height={64}
              priority
              src="/logotype/logotype.png"
              width={64}
            />
          </div>
        </div>
      </div>

      <section className="flex min-h-0 items-center justify-center px-6 py-8 md:px-12 [@media(max-height:500px)]:py-3">
        <div className="w-full max-w-sm">
          <header className="mb-6 [@media(max-height:500px)]:mb-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {step === "email" ? "Sign in to Mono" : "Check your email"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground [@media(max-height:500px)]:mt-1">
              {step === "email"
                ? "Enter your email to receive a sign-in code."
                : <>Enter the six-digit code sent to <strong className="font-medium text-foreground">{email}</strong>.</>}
            </p>
          </header>

          {step === "email" ? (
            <form className="grid gap-4 [@media(max-height:500px)]:gap-2" onSubmit={(event) => void sendCode(event)}>
              <div className="grid gap-2 [@media(max-height:500px)]:gap-1">
                <Label htmlFor="email">Email address</Label>
                <Input
                  autoComplete="email"
                  autoFocus
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button
                aria-busy={pendingAction === "send"}
                className="h-10 w-full text-[0.8125rem]"
                disabled={isPending || !email.trim()}
                type="submit"
              >
                {pendingAction === "send" ? (
                  <>
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                    Sending code...
                  </>
                ) : (
                  "Continue with email"
                )}
              </Button>
            </form>
          ) : (
            <div className="grid gap-4 [@media(max-height:500px)]:gap-2">
              <Button
                className="-ml-2 w-fit"
                disabled={isPending}
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                }}
                type="button"
                variant="ghost"
              >
                <ArrowLeft aria-hidden="true" />
                Change email
              </Button>
              <form className="grid gap-4 [@media(max-height:500px)]:gap-2" onSubmit={verifyCode}>
                <div className="grid gap-2 [@media(max-height:500px)]:gap-1">
                  <Label htmlFor="code">Sign-in code</Label>
                  <Input
                    autoComplete="one-time-code"
                    autoFocus
                    id="code"
                    inputMode="numeric"
                    maxLength={6}
                    name="code"
                    pattern="[0-9]{6}"
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
                <Button
                  aria-busy={pendingAction === "verify"}
                  className="h-10 w-full text-[0.8125rem]"
                  disabled={isPending || code.length !== 6}
                  type="submit"
                >
                  {pendingAction === "verify" ? (
                    <>
                      <LoaderCircle aria-hidden="true" className="animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
              <Button
                aria-busy={pendingAction === "send"}
                className="h-10 w-full text-[0.8125rem]"
                disabled={isPending}
                onClick={() => void sendCode()}
                type="button"
                variant="outline"
              >
                {pendingAction === "send" ? (
                  <>
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                    Sending code...
                  </>
                ) : (
                  "Send a new code"
                )}
              </Button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
