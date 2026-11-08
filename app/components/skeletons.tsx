/** Shared skeletons matched to each page's final layout. */

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-md bg-muted motion-reduce:animate-none ${className ?? ""}`}
    />
  );
}

export function FeedSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading your feed"
      className="mx-auto w-full max-w-[350px]"
      role="status"
    >
      {[0, 1].map((item) => (
        <div className="mb-8" key={item}>
          <div className="mb-3 flex items-center gap-3 px-1">
            <Skeleton className="size-9 rounded-full" />
            <div className="grid gap-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          </div>
          <Skeleton className="aspect-square w-full rounded-[2rem]" />
          <div className="flex items-center gap-3 px-1 pt-3">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading Instants</span>
    </div>
  );
}

export function CreateSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading the camera"
      className="mx-auto w-full max-w-[350px]"
      role="status"
    >
      <Skeleton className="mx-auto mb-4 h-6 w-28" />
      <Skeleton className="aspect-square w-full rounded-[2rem]" />
      <Skeleton className="mx-4 -mt-6 block h-11 rounded-full" />
      <Skeleton className="mt-9 h-12 w-full rounded-full" />
      <span className="sr-only">Preparing the camera</span>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading your profile"
      className="mx-auto w-full max-w-2xl"
      role="status"
    >
      <div className="flex items-center gap-4">
        <Skeleton className="size-20 rounded-full sm:size-24" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-48 max-w-full" />
        </div>
      </div>
      <div className="mt-6 border-t border-border/60 pt-4">
        <Skeleton className="h-4 w-16" />
        <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-5 sm:gap-2 md:grid-cols-6">
          {Array.from({ length: 12 }, (_, index) => (
            <Skeleton className="aspect-square rounded-md" key={index} />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading your profile</span>
    </div>
  );
}

export function NotificationsSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading notifications"
      className="mx-auto w-full max-w-2xl"
      role="status"
    >
      <div className="flex items-end justify-between gap-3">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
      <div className="mt-4 flex gap-1.5">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-7 w-16 rounded-full" key={index} />
        ))}
      </div>
      <ul className="mt-2 divide-y divide-border/60 border-y border-border/60">
        {Array.from({ length: 6 }, (_, index) => (
          <li className="flex items-center gap-3 py-3" key={index}>
            <Skeleton className="size-9 rounded-full" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-2.5 w-1/4" />
            </div>
          </li>
        ))}
      </ul>
      <span className="sr-only">Loading notifications</span>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading settings"
      className="mx-auto w-full max-w-2xl space-y-6"
      role="status"
    >
      <div>
        <Skeleton className="h-6 w-28" />
        <Skeleton className="mt-1 h-3 w-44" />
      </div>
      {Array.from({ length: 4 }, (_, section) => (
        <div key={section}>
          <Skeleton className="mb-1.5 ml-1 h-2.5 w-20" />
          <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
            {Array.from({ length: section === 3 ? 2 : 2 }, (_, row) => (
              <div className="flex items-center gap-3 px-4 py-3 sm:px-5" key={row}>
                <Skeleton className="size-9 rounded-lg" />
                <div className="grid flex-1 gap-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-40" />
                </div>
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <span className="sr-only">Loading settings</span>
    </div>
  );
}

export function ConnectionsSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading your links"
      className="mx-auto w-full max-w-2xl"
      role="status"
    >
      <div className="mb-6">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="mt-2 h-3 w-80 max-w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 w-20 rounded-xl" />
      </div>
      <div className="mt-7 divide-y divide-border/60 rounded-xl bg-muted/20 px-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="flex min-h-16 items-center gap-3 py-3" key={index}>
            <Skeleton className="size-10 rounded-full" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading your links</span>
    </div>
  );
}

export function PublicProfileSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading profile"
      className="mx-auto max-w-xl"
      role="status"
    >
      <div className="flex items-start gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="grid flex-1 gap-2 pt-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-64 max-w-full" />
          <Skeleton className="mt-1 h-3 w-28" />
        </div>
      </div>
      <span className="sr-only">Loading profile</span>
    </div>
  );
}
