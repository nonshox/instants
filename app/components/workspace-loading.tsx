import Image from "next/image";
import { FeedSkeleton, Skeleton } from "@/app/components/skeletons";

export function WorkspaceLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Checking your session"
      className="min-h-dvh bg-background"
      role="status"
    >
      <span className="sr-only">Checking your session...</span>
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Image
              alt=""
              aria-hidden="true"
              className="size-8 rounded-md object-cover border-2 border-black/40"
              height={32}
              src="/logotype/logotype.png"
              width={32}
            />
            <span className="font-semibold tracking-tight">Mono</span>
          </div>
          <nav aria-hidden="true" className="hidden items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-1 md:flex">
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 sm:pt-8">
        <FeedSkeleton />
      </main>
    </div>
  );
}
