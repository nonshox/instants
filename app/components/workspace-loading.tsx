import Image from "next/image";

export function WorkspaceLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Checking your session"
      className="min-h-dvh bg-background"
      role="status"
    >
      <span className="sr-only">Checking your session...</span>
      <header className="bg-background">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="size-8 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
            <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
              <Image
                alt=""
                aria-hidden="true"
                className="size-6 rounded-md object-cover"
                height={24}
                priority
                src="/logotype/logotype.png"
                width={24}
              />
              Mono
            </span>
          </div>
          <span className="size-8 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 grid gap-2">
          <span className="h-3 w-20 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <span className="h-7 w-36 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((item) => (
            <div
              aria-hidden="true"
              className="overflow-hidden rounded-xl bg-muted/50 p-2"
              key={item}
            >
              <div className="aspect-square animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
              <div className="flex items-center gap-2 px-2 py-3">
                <span className="size-7 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
                <span className="h-3 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
