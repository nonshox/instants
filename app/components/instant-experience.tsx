"use client";

import { useEffect } from "react";
import { InstantComposer } from "@/app/components/instant-composer";
import { useInstantStore } from "@/src/features/instants/store";

export function InstantExperience({ accountId }: { accountId: string }) {
  const setAccountId = useInstantStore((state) => state.setAccountId);

  useEffect(() => {
    setAccountId(accountId);
  }, [accountId, setAccountId]);

  return <InstantComposer />;
}
