"use client";

import { ExternalLink, Link2, Unlink } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createTelegramLink,
  disconnectTelegram,
  fetchTelegramStatus,
} from "@/src/features/telegram/client-api";
import { getApiErrorMessage } from "@/src/lib/api-client";

export function IntegrationExperience() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const isConnected = await fetchTelegramStatus();
      setConnected(isConnected);
      if (isConnected) setLink("");
    } catch {
      setError("Telegram status could not be checked.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchTelegramStatus()
      .then((isConnected) => {
        if (active) setConnected(isConnected);
      })
      .catch(() => {
        if (active) setError("Telegram status could not be checked.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const createLink = async () => {
    setPending(true);
    setError("");
    try {
      setLink(await createTelegramLink());
    } catch (cause) {
      setError(
        getApiErrorMessage(
          cause,
          "A Telegram link could not be created.",
        ),
      );
    } finally {
      setPending(false);
    }
  };

  const disconnect = async () => {
    setPending(true);
    setError("");
    try {
      await disconnectTelegram();
      setConnected(false);
      setLink("");
    } catch {
      setError("Telegram could not be disconnected.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="mt-6 scroll-mt-6 gap-0 py-0 shadow-none" id="telegram">
      <CardHeader className="border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <Link2 aria-hidden="true" className="text-muted-foreground" size={19} />
          <div>
            <CardTitle className="text-base font-semibold">Telegram</CardTitle>
            <CardDescription className="mt-1 text-xs">
              Receive a private message when something happens.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p className="m-0 text-xs text-muted-foreground" role="status">
          {loading
            ? "Checking connection..."
            : connected
              ? "Telegram is connected."
              : "Telegram is not connected."}
        </p>
        {connected ? (
          <Button
            disabled={pending || loading}
            onClick={() => void disconnect()}
            type="button"
            variant="outline"
          >
            <Unlink aria-hidden="true" size={15} />
            {pending ? "Disconnecting..." : "Disconnect"}
          </Button>
        ) : (
          <Button
            disabled={pending || loading}
            onClick={() => void createLink()}
            type="button"
          >
            <Link2 aria-hidden="true" size={15} />
            {pending ? "Creating link..." : "Connect Telegram"}
          </Button>
        )}
        {link && (
          <a
            className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-4"
            href={link}
            rel="noreferrer"
            target="_blank"
          >
            Open Telegram to finish linking <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
        {!loading && !connected && link && (
          <Button
            className="text-xs"
            onClick={() => void refresh()}
            type="button"
            variant="ghost"
          >
            Check connection
          </Button>
        )}
        {error && (
          <p className="m-0 w-full text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
