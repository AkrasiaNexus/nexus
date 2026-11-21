// Shown instantly on navigation while the server fetches the next page.
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 px-5 pt-16" role="status" aria-label="Loading">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-card" />
      <div className="h-40 animate-pulse rounded-2xl bg-card" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 animate-pulse rounded-2xl bg-card" />
        <div className="h-24 animate-pulse rounded-2xl bg-card" />
      </div>
      <div className="h-28 animate-pulse rounded-2xl bg-card" />
    </div>
  );
}
